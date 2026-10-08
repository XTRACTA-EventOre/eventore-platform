import { DomainError } from '../../errors/DomainError.js';

export function ensureLotIsActive(lot) {
  if (lot.status === 'Cancelled') {
    throw new DomainError('LOT_CANCELLED','El lote está cancelado');
  }
  if (lot.status !== 'Registered') {
    throw new DomainError('INVALID_LOT_STATUS','Estado del lote inválido');
  }
  return lot;
}
