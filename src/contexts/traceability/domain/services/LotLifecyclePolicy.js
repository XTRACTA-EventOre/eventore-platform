import { OperationError as LifecycleError } from '../../../../shared/application/OperationError.js';
export { OperationError as LifecycleError } from '../../../../shared/application/OperationError.js';

export function requireRegisteredVersion(lot, expectedVersion) {
  if (!lot) throw new LifecycleError(404, 'LOT_NOT_FOUND', 'Lote no encontrado');
  if (lot.version !== expectedVersion) throw new LifecycleError(409, 'VERSION_CONFLICT', 'El lote cambió; vuelve a consultarlo');
  if (lot.status !== 'Registered') throw new LifecycleError(409, 'INVALID_LOT_STATE',
    'La operación requiere un lote registrado que todavía no haya salido de origen');
}

export function requireTransferAllowed(restrictions) {
  if (restrictions.length) throw new LifecycleError(409, 'TRANSFER_RESTRICTED', 'El lote tiene una restricción operativa activa');
}

export function requireValidHandover(handover, userId, now = new Date()) {
  if (!handover || handover.state !== 'Available' || new Date(handover.expires_at) <= now) {
    throw new LifecycleError(409, 'INVALID_HANDOVER', 'La entrega no está disponible o venció');
  }
  if (handover.recipient_user_id && handover.recipient_user_id !== userId) {
    throw new LifecycleError(403, 'HANDOVER_RECIPIENT_MISMATCH', 'La entrega está asignada a otro transportista');
  }
}
