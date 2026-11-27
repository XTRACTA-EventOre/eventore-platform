import { Router, raw } from 'express';
import { requirePermission } from '../../shared/infrastructure/http/permissions.js';
import { operationBody, apiError, uuid, text } from '../../shared/infrastructure/http/operationHttp.js';
import { ShipmentService } from './ShipmentService.js';

export function createShipmentRouter(options, authenticate) {
  const router = Router(), service = new ShipmentService(options);
  router.get('/lots/:lotId', authenticate, requirePermission('lots.read'), async (req, res) => {
    try { res.json(await service.read(req.identity.tenantId, uuid(req.params.lotId), req)); }
    catch (error) { apiError(res, error); }
  });
  router.post('/lots/:lotId/evidence', authenticate, requirePermission('shipments.report'), raw({ type: ['image/jpeg','image/png'], limit: '5mb' }), async (req, res) => {
    try { res.status(201).json(await service.upload(uuid(req.params.lotId), req)); }
    catch (error) { apiError(res, error); }
  });
  router.get('/evidence/:photoId', authenticate, requirePermission('lots.read'), async (req, res) => {
    try {
      const [[photo]] = await options.pool.execute('SELECT mime_type,content FROM shipment_evidence WHERE tenant_id=? AND id=?', [req.identity.tenantId, uuid(req.params.photoId)]);
      if (!photo) return res.status(404).json({ error: { code: 'EVIDENCE_NOT_FOUND', message: 'Fotografía no encontrada' } });
      res.set('X-Content-Type-Options', 'nosniff').type(photo.mime_type).send(photo.content);
    } catch (error) { apiError(res, error); }
  });
  const routes = [
    ['checkpoints', 'CheckpointRecorded', 'shipments.checkpoint', body => ({ measurement: { weight: body.weight, weightUnit: body.weightUnit }, location: text(body.location, 'Checkpoint', 200) })],
    ['incidents', 'IncidentReported', 'shipments.report', body => ({ description: text(body.description, 'Descripción'), severity: body.severity, photoIds: Array.isArray(body.photoIds) ? body.photoIds.map(id => uuid(id)) : [] })],
    ['delegations', 'DelegationProposed', 'shipments.delegate', body => ({ recipientUserId: uuid(body.recipientUserId) })],
    ['delegation-acceptance', 'DelegationAccepted', 'custody.accept', body => ({ delegationId: uuid(body.delegationId) })],
    ['receipt', 'PlantReceived', 'shipments.receive', body => ({ quarantineDecision: body.quarantineDecision ?? null, reviewReason: body.reviewReason?.trim() || null })],
    ['restriction-review', 'RestrictionReviewed', 'shipments.review', body => ({ restrictionId: uuid(body.restrictionId), decision: body.decision, reason: text(body.reason, 'Motivo') })]
  ];
  for (const [path, action, permission, payload] of routes) router.post(`/lots/:lotId/${path}`, authenticate, requirePermission(permission), async (req, res) => {
    try { const command = { ...operationBody(req, action), ...payload(req.body ?? {}) }; res.json(await service.execute(command, req)); }
    catch (error) { apiError(res, error); }
  });
  router.use((error, _req, res, next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ error: { code: 'EVIDENCE_TOO_LARGE', message: 'La fotografía excede 5 MB' } });
    next(error);
  });
  return router;
}
