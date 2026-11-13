import { Router } from 'express';
import { assertUuid } from '../../domain/validation/domainAssertions.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import { LifecycleError } from '../../domain/services/LotLifecyclePolicy.js';
import { requirePermission } from '../../../../shared/infrastructure/http/permissions.js';

export function operationError(res, error) {
  if (error instanceof LifecycleError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  if (error instanceof DomainError) return res.status(400).json({ error: { code: error.code, message: error.message } });
  return res.status(503).json({ error: { code: 'OPERATION_NOT_CONFIRMED', message: 'No se confirmó la operación; reintenta con el mismo identificador' } });
}

export function lifecycleCommand(req, action) {
  const body = req.body ?? {};
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) {
    throw new LifecycleError(400, 'INVALID_VERSION', 'Indica la versión del lote consultado');
  }
  const command = { action, tenantId: req.identity.tenantId, actorId: req.identity.userId,
    lotId: assertUuid(req.params.lotId, 'lotId').toLowerCase(),
    operationId: assertUuid(body.operationId, 'operationId').toLowerCase(), expectedVersion: body.expectedVersion };
  if (action === 'Cancelled') {
    if (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 1000) {
      throw new LifecycleError(400, 'INVALID_REASON', 'Indica un motivo de hasta 1000 caracteres');
    }
    command.reason = body.reason.trim();
  }
  if (action === 'HandoverPrepared') command.recipientUserId = body.recipientUserId == null ? null : assertUuid(body.recipientUserId, 'recipientUserId').toLowerCase();
  if (action === 'CustodyAccepted') command.handoverId = assertUuid(body.handoverId, 'handoverId').toLowerCase();
  return command;
}

export function createLifecycleRouter({ lifecycle, authenticate, verifyRecipient }) {
  const router = Router();
  router.get('/:lotId/operations', authenticate, requirePermission('lots.read'), async (req, res) => {
    try { res.json(await lifecycle.read({ tenantId: req.identity.tenantId, lotId: assertUuid(req.params.lotId, 'lotId').toLowerCase() })); }
    catch (error) { operationError(res, error); }
  });
  router.post('/:lotId/cancellation', authenticate, requirePermission('lots.cancel'), async (req, res) => {
    try { res.json(await lifecycle.execute(lifecycleCommand(req, 'Cancelled'))); }
    catch (error) { operationError(res, error); }
  });
  router.post('/:lotId/handovers', authenticate, requirePermission('lots.release'), async (req, res) => {
    try {
      const command = lifecycleCommand(req, 'HandoverPrepared');
      if (command.recipientUserId) await verifyRecipient(command.recipientUserId, req);
      res.status(201).json(await lifecycle.execute(command));
    } catch (error) { operationError(res, error); }
  });
  return router;
}
