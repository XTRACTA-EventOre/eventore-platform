import { isDeepStrictEqual } from 'node:util';
import { OperationError } from '../../application/OperationError.js';

export class DurableOperation {
  constructor(pool, table) {
    if (!['logistics_operations','processing_operations','jewelry_operations'].includes(table)) throw new Error('Tabla de operaciones no permitida');
    Object.assign(this, { pool, table });
  }
  async start(command) {
    try {
      await this.pool.execute(`INSERT INTO ${this.table}(tenant_id,operation_id,actor_id,action,state,command)
        VALUES(?,?,?,?,'Pending',?)`, [command.tenantId, command.operationId, command.actorId, command.action, JSON.stringify(command)]);
    } catch (error) { if (error.code !== 'ER_DUP_ENTRY') throw error; }
    const [[record]] = await this.pool.execute(`SELECT command,state,result FROM ${this.table} WHERE tenant_id=? AND operation_id=?`, [command.tenantId, command.operationId]);
    if (!isDeepStrictEqual(record.command, command)) throw new OperationError(409, 'OPERATION_ID_REUSED', 'El identificador corresponde a otra operación');
    if (record.state === 'Rejected') throw new OperationError(record.result.status, record.result.code, record.result.message);
    return record;
  }
  async confirm(command, result, apply = async () => {}) {
    const tx = await this.pool.getConnection();
    try {
      await tx.beginTransaction();
      const [[record]] = await tx.execute(`SELECT state,result FROM ${this.table} WHERE tenant_id=? AND operation_id=? FOR UPDATE`, [command.tenantId, command.operationId]);
      if (record.state === 'Accepted') { await tx.commit(); return record.result; }
      await apply(tx, result);
      await tx.execute(`UPDATE ${this.table} SET state='Accepted',result=?,updated_at=UTC_TIMESTAMP(3) WHERE tenant_id=? AND operation_id=?`, [JSON.stringify(result), command.tenantId, command.operationId]);
      await tx.commit(); return result;
    } catch (error) { await tx.rollback().catch(() => {}); throw error; }
    finally { tx.release(); }
  }
  async reject(command, error) {
    if (error instanceof OperationError && error.status < 500) {
      await this.pool.execute(`UPDATE ${this.table} SET state='Rejected',result=?,updated_at=UTC_TIMESTAMP(3)
        WHERE tenant_id=? AND operation_id=? AND state='Pending'`, [JSON.stringify({ status: error.status, code: error.code, message: error.message }), command.tenantId, command.operationId]);
    }
  }
}
