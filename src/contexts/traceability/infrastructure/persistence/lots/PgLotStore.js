export class PgUnitOfWork {
  constructor(pool) { this.pool = pool; }
  async run(work) {
    const tx = await this.pool.connect();
    try {
      await tx.query('BEGIN');
      const result = await work(tx);
      await tx.query('COMMIT');
      return result;
    } catch (error) {
      await tx.query('ROLLBACK');
      throw error;
    } finally { tx.release(); }
  }
}

export class PgLotStore {
  constructor(pool) { this.pool = pool; }
  async save({ tx, lot }) {
    const d = lot.toPrimitives();
    await tx.query(`INSERT INTO mineral_lots
      (id,tenant_id,mineral_type,weight,weight_unit,status,version,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [d.id,d.tenantId,d.mineralType,d.weight,d.weightUnit,
      d.status,d.version,d.createdAt]);
    const e = d.originEvidence;
    await tx.query(`INSERT INTO origin_evidence
      (id,tenant_id,lot_id,reference,source,review_status)
      VALUES ($1,$2,$3,$4,$5,$6)`,
    [e.id,d.tenantId,d.id,e.reference,e.source,e.reviewStatus]);
    for (const event of d.traceEvents) {
      await tx.query(`INSERT INTO trace_events
        (id,tenant_id,lot_id,client_event_id,source_id,event_type,occurred_at,payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [event.id,d.tenantId,d.id,event.clientEventId,event.sourceId,
        event.eventType,event.occurredAt,JSON.stringify(event.payload)]);
    }
  }
  async findById({ lotId, tenantId }) {
    const { rows } = await this.pool.query(`SELECT
      l.id,l.tenant_id AS "tenantId",l.mineral_type AS "mineralType",
      l.weight::text AS weight,l.weight_unit AS "weightUnit",
      l.status,l.version,e.review_status AS "originEvidenceStatus"
      FROM mineral_lots l JOIN origin_evidence e
      ON e.tenant_id=l.tenant_id AND e.lot_id=l.id
      WHERE l.tenant_id=$1 AND l.id=$2`, [tenantId,lotId]);
    return rows[0] ?? null;
  }
}
