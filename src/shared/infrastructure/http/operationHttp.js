import { OperationError } from '../../application/OperationError.js';
export function uuid(value, field = 'identificador') {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new OperationError(400, 'INVALID_UUID', `${field} debe ser un UUID válido`);
  return value.toLowerCase();
}
export function text(value, field, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new OperationError(400, 'INVALID_TEXT', `${field} es obligatorio y admite hasta ${max} caracteres`);
  return value.trim();
}
export function version(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new OperationError(400, 'INVALID_VERSION', 'Consulta primero la versión vigente');
  return value;
}
export function operationBody(req, action) {
  return { action, tenantId: req.identity.tenantId, actorId: req.identity.userId,
    operationId: uuid(req.body?.operationId, 'operationId'), expectedVersion: version(req.body?.expectedVersion),
    lotId: uuid(req.params.lotId, 'lotId') };
}
export function apiError(res, error) {
  return error instanceof OperationError
    ? res.status(error.status).json({ error: { code: error.code, message: error.message } })
    : res.status(503).json({ error: { code: 'OPERATION_NOT_CONFIRMED', message: 'Operación sin confirmar; conserva el identificador para reintentar' } });
}
