import { isDeepStrictEqual } from 'node:util';
import { OperationError } from '../../shared/application/OperationError.js';

export class CustodyService {
  constructor({ pool, traceabilityUrl, internalSecret, fetchImpl = fetch }) {
    Object.assign(this, { pool, traceabilityUrl, internalSecret, fetchImpl });
  }
  async callTraceability(path, req, body) {
    try {
      const response = await this.fetchImpl(new URL(path, this.traceabilityUrl), {
        method: body ? 'POST' : 'GET',
        headers: { cookie: req.headers.cookie ?? '', 'x-internal-secret': this.internalSecret,
          ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(6000)
      });
      const result = await response.json();
      if (!response.ok) {
        if ([400,401,403,404,409].includes(response.status)) {
          throw new OperationError(response.status, result.error?.code ?? 'TRACEABILITY_REJECTED', result.error?.message ?? 'Operación rechazada');
        }
        throw new Error('Traceability unavailable');
      }
      return result;
    } catch (error) {
      if (error instanceof OperationError) throw error;
      throw new OperationError(503, 'CUSTODY_NOT_CONFIRMED', 'Custodia sin confirmar; reintenta con el mismo identificador');
    }
  }
  validateResult(command, result) {
    if (result.operationId !== command.operationId || result.lotId !== command.lotId ||
      result.custodianUserId !== command.actorId || result.handoverId !== command.handoverId ||
      result.version !== command.expectedVersion + 1 || result.status !== 'InTransit' || result.action !== 'CustodyAccepted') {
      throw new OperationError(503, 'INVALID_CUSTODY_RESPONSE', 'No se pudo confirmar la respuesta de trazabilidad');
    }
  }
  async confirm(command, result) {
    this.validateResult(command, result);
    await this.pool.execute(`UPDATE custody_operations SET state='Accepted',result=?,updated_at=UTC_TIMESTAMP(3)
      WHERE tenant_id=? AND operation_id=?`, [JSON.stringify(result), command.tenantId, command.operationId]);
    return result;
  }
  async accept(command, req) {
    try {
      await this.pool.execute(`INSERT INTO custody_operations(tenant_id,operation_id,lot_id,actor_id,state,command)
        VALUES(?,?,?,?,'Pending',?)`, [command.tenantId, command.operationId, command.lotId, command.actorId, JSON.stringify(command)]);
    } catch (error) { if (error.code !== 'ER_DUP_ENTRY') throw error; }
    const [[record]] = await this.pool.execute('SELECT command,state,result FROM custody_operations WHERE tenant_id=? AND operation_id=?', [command.tenantId, command.operationId]);
    if (!isDeepStrictEqual(record.command, command)) throw new OperationError(409, 'OPERATION_ID_REUSED', 'El identificador ya corresponde a otra aceptación');
    if (record.state === 'Accepted') return record.result;
    if (record.state === 'Rejected') throw new OperationError(record.result.status, record.result.code, record.result.message);
    try {
      const result = await this.callTraceability(`/internal/lots/${command.lotId}/custody-accept`, req,
        { operationId: command.operationId, handoverId: command.handoverId, expectedVersion: command.expectedVersion });
      return await this.confirm(command, result);
    } catch (error) {
      if (error instanceof OperationError && error.status < 500) {
        await this.pool.execute(`UPDATE custody_operations SET state='Rejected',result=?,updated_at=UTC_TIMESTAMP(3)
          WHERE tenant_id=? AND operation_id=? AND state='Pending'`,
          [JSON.stringify({ status: error.status, code: error.code, message: error.message }), command.tenantId, command.operationId]);
      }
      throw error;
    }
  }
  async read({ tenantId, lotId }, req) {
    // Validate visibility using the owner's API, never its database.
    await this.callTraceability(`/api/v1/lots/${lotId}`, req);
    const [pending] = await this.pool.execute("SELECT command FROM custody_operations WHERE tenant_id=? AND lot_id=? AND state='Pending'", [tenantId, lotId]);
    for (const { command } of pending) {
      try {
        const result = await this.callTraceability(`/internal/custody-operations/${command.operationId}`, req);
        await this.confirm(command, result);
      } catch (error) {
        if (!(error instanceof OperationError) || ![404,503].includes(error.status)) throw error;
      }
    }
    const [rows] = await this.pool.execute('SELECT state,result,operation_id FROM custody_operations WHERE tenant_id=? AND lot_id=? ORDER BY updated_at,operation_id', [tenantId, lotId]);
    return { custody: rows.find(row => row.state === 'Accepted')?.result ?? null,
      pending: rows.filter(row => row.state === 'Pending').map(row => row.operation_id) };
  }
}
