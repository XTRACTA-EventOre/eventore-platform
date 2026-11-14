import { MySqlLotLifecycle } from '../../contexts/traceability/infrastructure/persistence/lots/MySqlLotLifecycle.js';
import { lifecycleCommand, operationError } from '../../contexts/traceability/infrastructure/http/lifecycle.routes.js';
import { LifecycleError } from '../../contexts/traceability/domain/services/LotLifecyclePolicy.js';
import { requirePermission } from '../../shared/infrastructure/http/permissions.js';
import { MySqlOperationalState } from '../../contexts/traceability/infrastructure/persistence/lots/MySqlOperationalState.js';
import { operationBody, apiError, uuid } from '../../shared/infrastructure/http/operationHttp.js';
import { createSprint1App } from '../../contexts/traceability/infrastructure/bootstrap/createSprint1App.js';
import { createSessionAuth } from '../../shared/infrastructure/http/sessionAuth.js';
import { createRemoteAuth } from './remoteAuth.js';
import { fileURLToPath } from 'node:url';

export function createTraceabilityApp({ pool, identityUrl, internalSecret, appBaseUrl, fetchImpl = fetch }) {
  const authenticate = createRemoteAuth({ identityUrl, internalSecret, fetchImpl });
  const { sameOrigin } = createSessionAuth({ pool: null, appBaseUrl });
  const verifyRecipient = async (userId, req) => {
    const response = await fetchImpl(new URL(`/internal/transporters/${userId}`, identityUrl), {
      headers: { cookie: req.headers.cookie ?? '', 'x-internal-secret': internalSecret }, signal: AbortSignal.timeout(3000)
    });
    if (response.status === 404) throw new LifecycleError(400, 'INVALID_RECIPIENT', 'Selecciona un transportista activo de tu organización');
    if (!response.ok) throw new Error('Identity unavailable');
  };
  const app = createSprint1App({ pool, authenticate, sameOrigin, appBaseUrl, verifyRecipient });
  const lifecycle = new MySqlLotLifecycle(pool);
  const operational = new MySqlOperationalState(pool);
  const internalOnly = (req, res, next) => req.get('x-internal-secret') === internalSecret ? next() : res.status(403).end();
  app.post('/internal/lots/:lotId/custody-accept', internalOnly, authenticate, requirePermission('custody.accept'), async (req, res) => {
    try { res.json(await lifecycle.execute(lifecycleCommand(req, 'CustodyAccepted'))); }
    catch (error) { operationError(res, error); }
  });
  app.get('/internal/custody-operations/:operationId', internalOnly, authenticate, requirePermission('lots.read'), async (req, res) => {
    try { res.json(await lifecycle.findCustodyOperation({ tenantId: req.identity.tenantId, operationId: req.params.operationId })); }
    catch (error) { operationError(res, error); }
  });
  app.get('/internal/lots/:lotId/state', internalOnly, authenticate, requirePermission('lots.read'), async (req, res) => {
    try { res.json(await operational.snapshot(req.identity.tenantId, uuid(req.params.lotId))); }
    catch (error) { apiError(res, error); }
  });
  app.get('/internal/lot-operations/:operationId', internalOnly, authenticate, requirePermission('lots.read'), async (req, res) => {
    try { res.json(await operational.find(req.identity.tenantId, uuid(req.params.operationId))); }
    catch (error) { apiError(res, error); }
  });
  const actionPermissions = { CheckpointRecorded: 'shipments.checkpoint', IncidentReported: 'shipments.report',
    DelegationProposed: 'shipments.delegate', DelegationAccepted: 'custody.accept', PlantReceived: 'shipments.receive',
    RestrictionReviewed: 'shipments.review', EvidenceReviewed: 'evidence.review' };
  app.post('/internal/lots/:lotId/operations', internalOnly, authenticate, (req, res, next) => {
    const permission = actionPermissions[req.body?.action];
    if (!permission) return res.status(400).json({ error: { code: 'INVALID_ACTION', message: 'Operación no reconocida' } });
    return requirePermission(permission)(req, res, next);
  }, async (req, res) => {
    try {
      const { action, tenantId: _tenant, actorId: _actor, lotId: _lot, operationId: _operation, expectedVersion: _version, ...payload } = req.body;
      const command = { ...operationBody(req, action), ...payload };
      res.json(await operational.execute(command, req.identity.permissions));
    } catch (error) { apiError(res, error); }
  });
  app.post('/api/v1/lots/:lotId/evidence-review', authenticate, requirePermission('evidence.review'), async (req, res) => {
    try { res.json(await operational.execute({ ...operationBody(req, 'EvidenceReviewed'), reviewStatus: req.body.reviewStatus, reason: req.body.reason }, req.identity.permissions)); }
    catch (error) { apiError(res, error); }
  });
  app.get('/api/v1/openapi.json', (_req, res) => res.sendFile(fileURLToPath(new URL('../../../docs/openapi.json', import.meta.url))));
  app.get('/api/v1/traceability/openapi.json', (_req, res) => res.sendFile(fileURLToPath(new URL('../../../docs/traceability-openapi.json', import.meta.url))));
  app.get('/api/docs', (_req, res) => res.type('html').send('<!doctype html><title>EventOre API</title><div id="swagger-ui"></div><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"><script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:"/api/v1/openapi.json",dom_id:"#swagger-ui"})</script>'));
  return app;
}
