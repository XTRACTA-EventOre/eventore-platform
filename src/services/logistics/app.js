import express from 'express';
import { createRemoteAuth } from '../../shared/infrastructure/http/remoteIdentity.js';
import { createSessionAuth } from '../../shared/infrastructure/http/sessionAuth.js';
import { requirePermission } from '../../shared/infrastructure/http/permissions.js';
import { OperationError } from '../../shared/application/OperationError.js';
import { CustodyService } from './CustodyService.js';

const uuid = (value, field) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value ?? '')) {
    throw new OperationError(400, 'INVALID_UUID', `${field} debe ser un UUID válido`);
  }
  return value.toLowerCase();
};
export function createLogisticsApp({ pool, identityUrl, traceabilityUrl, internalSecret, appBaseUrl, fetchImpl = fetch }) {
  if (!traceabilityUrl || !internalSecret) throw new Error('Configura TRACEABILITY_URL e INTERNAL_AUTH_SECRET');
  const app = express(); app.disable('x-powered-by'); app.use(express.json());
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(createSessionAuth({ pool: null, appBaseUrl }).sameOrigin);
  const authenticate = createRemoteAuth({ identityUrl, internalSecret, fetchImpl });
  const custody = new CustodyService({ pool, traceabilityUrl, internalSecret, fetchImpl });
  const failed = (res, error) => error instanceof OperationError
    ? res.status(error.status).json({ error: { code: error.code, message: error.message } })
    : res.status(503).json({ error: { code: 'CUSTODY_NOT_CONFIRMED', message: 'Reintenta con el mismo identificador' } });
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'logistics' }));
  app.post('/api/v1/custody/lots/:lotId/accept', authenticate, requirePermission('custody.accept'), async (req, res) => {
    try {
      const body = req.body ?? {};
      if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) throw new OperationError(400, 'INVALID_VERSION', 'Indica la versión del lote consultado');
      const command = { tenantId: req.identity.tenantId, actorId: req.identity.userId,
        lotId: uuid(req.params.lotId, 'lotId'), operationId: uuid(body.operationId, 'operationId'),
        handoverId: uuid(body.handoverId, 'handoverId'), expectedVersion: body.expectedVersion };
      res.json(await custody.accept(command, req));
    } catch (error) { failed(res, error); }
  });
  app.get('/api/v1/custody/lots/:lotId', authenticate, requirePermission('lots.read'), async (req, res) => {
    try { res.json(await custody.read({ tenantId: req.identity.tenantId, lotId: uuid(req.params.lotId, 'lotId') }, req)); }
    catch (error) { failed(res, error); }
  });
  return app;
}
