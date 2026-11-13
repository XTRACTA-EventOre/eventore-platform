import { toSqlTimestamp } from '../../../../../shared/infrastructure/persistence/mysql.js';

export class MySqlUnitOfWork {
  constructor(pool) { this.pool = pool; }
  async run(work) {
    for (let attempt = 0; ; attempt++) {
      const tx = await this.pool.getConnection();
      try {
        await tx.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        await tx.beginTransaction();
        const result = await work(tx);
        await tx.commit();
        return result;
      } catch (error) {
        await tx.rollback().catch(() => {});
        if (attempt >= 2 || !['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) throw error;
      } finally { tx.release(); }
    }
  }
}

export class MySqlLotStore {
  constructor(pool) { this.pool = pool; }
  async save({ tx, lot }) {
    const d = lot.toPrimitives();
    await tx.execute(`INSERT INTO mineral_lots
      (id,tenant_id,mineral_type,weight,weight_unit,status,version,created_at)
      VALUES (?,?,?,?,?,?,?,?)`,
    [d.id,d.tenantId,d.mineralType,d.weight,d.weightUnit,
      d.status,d.version,toSqlTimestamp(d.createdAt)]);
    const e = d.originEvidence;
    await tx.execute(`INSERT INTO origin_evidence
      (id,tenant_id,lot_id,reference,source,review_status)
      VALUES (?,?,?,?,?,?)`,
    [e.id,d.tenantId,d.id,e.reference,e.source,e.reviewStatus]);
    for (const event of d.traceEvents) {
      await tx.execute(`INSERT INTO trace_events
        (id,tenant_id,lot_id,client_event_id,source_id,event_type,occurred_at,payload)
        VALUES (?,?,?,?,?,?,?,?)`,
      [event.id,d.tenantId,d.id,event.clientEventId,event.sourceId,
        event.eventType,toSqlTimestamp(event.occurredAt),JSON.stringify(event.payload)]);
    }
  }
  async findById({ lotId, tenantId }) {
    const [rows] = await this.pool.execute(`SELECT
      l.id,l.tenant_id AS "tenantId",l.mineral_type AS "mineralType",
      l.weight AS weight,l.weight_unit AS "weightUnit",
      l.status,l.version,e.review_status AS "originEvidenceStatus"
      FROM mineral_lots l JOIN origin_evidence e
      ON e.tenant_id=l.tenant_id AND e.lot_id=l.id
      WHERE l.tenant_id=? AND l.id=?`, [tenantId,lotId]);
    if (!rows[0]) return null;
    return { ...rows[0], weight: rows[0].weight.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1') };
  }
}
