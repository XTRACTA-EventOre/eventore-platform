import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { MySqlUnitOfWork } from './MySqlLotStore.js';
import { LifecycleError, requireRegisteredVersion, requireTransferAllowed, requireValidHandover } from '../../../domain/services/LotLifecyclePolicy.js';

export class MySqlLotLifecycle {
  constructor(pool) { this.pool = pool; this.unitOfWork = new MySqlUnitOfWork(pool); }
  async execute(command) {
    try {
      return await this.unitOfWork.run(async tx => {
        const { tenantId, lotId, operationId, actorId, expectedVersion, action } = command;
        const [lots] = await tx.execute('SELECT status,version FROM mineral_lots WHERE tenant_id=? AND id=? FOR UPDATE', [tenantId, lotId]);
        if (!lots.length) throw new LifecycleError(404, 'LOT_NOT_FOUND', 'Lote no encontrado');
        const [events] = await tx.execute('SELECT command,result FROM lot_lifecycle_events WHERE tenant_id=? AND operation_id=?', [tenantId, operationId]);
        if (events.length) {
          if (!isDeepStrictEqual(events[0].command, command)) throw new LifecycleError(409, 'OPERATION_ID_REUSED', 'El identificador ya corresponde a otra operación');
          return events[0].result;
        }
        const lot = lots[0];
        requireRegisteredVersion(lot, expectedVersion);
        const now = new Date();
        const result = { operationId, lotId, status: lot.status, version: lot.version + 1,
          actorId, action, occurredAt: now.toISOString() };
        if (action === 'Cancelled') {
          result.status = 'Cancelled'; result.reason = command.reason;
          await tx.execute("UPDATE lot_handovers SET state='Revoked' WHERE tenant_id=? AND lot_id=? AND state='Available'", [tenantId, lotId]);
        } else {
          const [restrictions] = await tx.execute('SELECT id FROM lot_restrictions WHERE tenant_id=? AND lot_id=? AND active=true', [tenantId, lotId]);
          requireTransferAllowed(restrictions);
          if (action === 'HandoverPrepared') {
            result.handoverId = randomUUID(); result.recipientUserId = command.recipientUserId;
            result.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
            await tx.execute("UPDATE lot_handovers SET state='Revoked' WHERE tenant_id=? AND lot_id=? AND state='Available'", [tenantId, lotId]);
            await tx.execute(`INSERT INTO lot_handovers(id,tenant_id,lot_id,recipient_user_id,prepared_by,state,expires_at)
              VALUES(?,?,?,?,?,'Available',?)`, [result.handoverId, tenantId, lotId, command.recipientUserId, actorId, new Date(result.expiresAt)]);
          } else if (action === 'CustodyAccepted') {
            const [handovers] = await tx.execute('SELECT * FROM lot_handovers WHERE tenant_id=? AND lot_id=? AND id=? FOR UPDATE', [tenantId, lotId, command.handoverId]);
            requireValidHandover(handovers[0], actorId, now);
            result.status = 'InTransit'; result.custodianUserId = actorId; result.handoverId = command.handoverId;
            await tx.execute("UPDATE lot_handovers SET state='Consumed' WHERE id=?", [command.handoverId]);
          } else throw new Error('Acción de ciclo de vida no admitida');
        }
        await tx.execute('UPDATE mineral_lots SET status=?,version=? WHERE tenant_id=? AND id=?', [result.status, result.version, tenantId, lotId]);
        await tx.execute(`INSERT INTO lot_lifecycle_events(operation_id,tenant_id,lot_id,actor_id,action,command,result)
          VALUES(?,?,?,?,?,?,?)`, [operationId, tenantId, lotId, actorId, action, JSON.stringify(command), JSON.stringify(result)]);
        return result;
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw new LifecycleError(409, 'OPERATION_ID_REUSED', 'El identificador ya corresponde a otra operación');
      throw error;
    }
  }
  async read({ tenantId, lotId }) {
    const [lots] = await this.pool.execute('SELECT id FROM mineral_lots WHERE tenant_id=? AND id=?', [tenantId, lotId]);
    if (!lots.length) throw new LifecycleError(404, 'LOT_NOT_FOUND', 'Lote no encontrado');
    const [history] = await this.pool.execute('SELECT result FROM lot_lifecycle_events WHERE tenant_id=? AND lot_id=? ORDER BY occurred_at,operation_id', [tenantId, lotId]);
    const [handovers] = await this.pool.execute("SELECT id,recipient_user_id AS recipientUserId,expires_at AS expiresAt FROM lot_handovers WHERE tenant_id=? AND lot_id=? AND state='Available' AND expires_at>UTC_TIMESTAMP(3)", [tenantId, lotId]);
    const [restrictions] = await this.pool.execute('SELECT id,reason FROM lot_restrictions WHERE tenant_id=? AND lot_id=? AND active=true', [tenantId, lotId]);
    return { history: history.map(event => event.result), handovers, restrictions };
  }
  async findCustodyOperation({ tenantId, operationId }) {
    const [events] = await this.pool.execute("SELECT result FROM lot_lifecycle_events WHERE tenant_id=? AND operation_id=? AND action='CustodyAccepted'", [tenantId, operationId]);
    if (!events.length) throw new LifecycleError(404, 'OPERATION_NOT_FOUND', 'Operación no encontrada');
    return events[0].result;
  }
}
