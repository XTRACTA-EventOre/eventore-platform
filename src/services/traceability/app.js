import express from 'express';
import swaggerUiDist from 'swagger-ui-dist';
import { GeofenceService } from './GeofenceService.js';
import { reportingSource } from './ReportingSource.js';
import { MySqlLotLifecycle } from '../../contexts/traceability/infrastructure/persistence/lots/MySqlLotLifecycle.js';
import { lifecycleCommand, operationError } from '../../contexts/traceability/infrastructure/http/lifecycle.routes.js';
import { LifecycleError } from '../../contexts/traceability/domain/services/LotLifecyclePolicy.js';
import { requirePermission } from '../../shared/infrastructure/http/permissions.js';
import { MySqlOperationalState } from '../../contexts/traceability/infrastructure/persistence/lots/MySqlOperationalState.js';
import { operationBody, apiError, uuid } from '../../shared/infrastructure/http/operationHttp.js';
import { MySqlProcessingState } from '../../contexts/traceability/infrastructure/persistence/lots/MySqlProcessingState.js';
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
  const processing = new MySqlProcessingState(pool);
  const internalOnly = (req, res, next) => internalSecret && req.get('x-internal-secret') === internalSecret ? next() : res.status(403).end();
  app.get('/internal/reporting/source',internalOnly,async(req,res)=>{try{res.json(await reportingSource(pool,uuid(req.get('x-service-tenant')),req.query));}catch(error){apiError(res,error);}});
  app.post('/internal/lots/:lotId/jewelry-receipt', internalOnly, authenticate, requirePermission('inventory.manage'), async (req,res) => {
    try { res.json(await operational.execute(operationBody(req,'JewelryReceived'),req.identity.permissions)); } catch(error) { apiError(res,error); }
  });
  // Read-only service contract: tenant comes from an authenticated server, never from a public request.
  app.get('/internal/certification/lots/:lotId', internalOnly, async (req,res) => {
    try { res.json(await processing.genealogy(uuid(req.get('x-service-tenant')),uuid(req.params.lotId))); } catch(error) { apiError(res,error); }
  });
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
  const geofences=new GeofenceService(pool);
  const geoHandle=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(error){apiError(res,error);}};
  app.get('/api/v1/geofences',authenticate,requirePermission('lots.read'),geoHandle(async req=>({concessions:await geofences.list(req.identity.tenantId)})));
  app.post('/api/v1/geofences',authenticate,requirePermission('geofences.manage'),geoHandle(req=>geofences.register({tenantId:req.identity.tenantId,actorId:req.identity.userId,operationId:uuid(req.body?.operationId),action:'ConcessionAuthorized',name:req.body?.name,polygon:req.body?.polygon,source:req.body?.source,authorizationRef:req.body?.authorizationRef,confirmAuthorization:req.body?.confirmAuthorization===true})));
  app.get('/api/v1/lots/:lotId/geofence',authenticate,requirePermission('lots.read'),geoHandle(req=>geofences.read(req.identity.tenantId,uuid(req.params.lotId))));
  app.post('/api/v1/lots/:lotId/geofence',authenticate,requirePermission('evidence.review'),geoHandle(req=>geofences.check({...operationBody(req,'LocationChecked'),location:req.body?.location??null,concessionId:req.body?.concessionId??null,reason:req.body?.reason})));
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
  app.get('/internal/lots/:lotId/processing', internalOnly, authenticate, requirePermission('lots.read'), async (req,res) => {
    try { res.json(await processing.view(req.identity.tenantId,uuid(req.params.lotId))); } catch(error) { apiError(res,error); }
  });
  app.get('/internal/lots/:lotId/genealogy', internalOnly, authenticate, requirePermission('lots.read'), async (req,res) => {
    try { res.json(await processing.genealogy(req.identity.tenantId,uuid(req.params.lotId))); } catch(error) { apiError(res,error); }
  });
  app.post('/internal/lots/:lotId/processing', internalOnly, authenticate, requirePermission('processing.manage'), async (req,res) => {
    try {
      const {action,tenantId:_tenant,actorId:_actor,lotId:_lot,operationId:_operation,expectedVersion:_version,...payload}=req.body;
      res.json(await processing.execute({...operationBody(req,action),...payload}));
    } catch(error) { apiError(res,error); }
  });
  app.get('/api/v1/openapi.json', (_req, res) => res.sendFile(fileURLToPath(new URL('../../../docs/openapi.json', import.meta.url))));
  app.get('/api/v1/traceability/openapi.json', (_req, res) => res.sendFile(fileURLToPath(new URL('../../../docs/traceability-openapi.json', import.meta.url))));
  app.use('/api/docs-assets',express.static(swaggerUiDist.getAbsoluteFSPath(),{index:false}));
  app.get('/api/docs',(_req,res)=>res.type('html').send('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>EventOre API Avance 4</title><div id="swagger-ui"></div><link rel="stylesheet" href="/api/docs-assets/swagger-ui.css"><script src="/api/docs-assets/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:"/api/v1/openapi.json",dom_id:"#swagger-ui",withCredentials:true,docExpansion:"list"})</script></html>'));
  return app;
}
