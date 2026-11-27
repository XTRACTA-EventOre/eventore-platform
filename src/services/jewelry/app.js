import {fileURLToPath} from 'node:url';
import { erpRouter } from './erp.js';
import express from 'express';
import { createRemoteAuth } from '../../shared/infrastructure/http/remoteIdentity.js';
import { createSessionAuth } from '../../shared/infrastructure/http/sessionAuth.js';
import { requirePermission } from '../../shared/infrastructure/http/permissions.js';
import { operationBody,uuid,text,version,apiError } from '../../shared/infrastructure/http/operationHttp.js';
import { JewelryService } from './JewelryService.js';
import { OperationError } from '../../shared/application/OperationError.js';
export function createJewelryApp(options){
  const {identityUrl,internalSecret,appBaseUrl,fetchImpl=fetch}=options,app=express(),service=new JewelryService(options);
  app.disable('x-powered-by');app.use(express.json());app.use(createSessionAuth({pool:null,appBaseUrl}).sameOrigin);
  const auth=createRemoteAuth({identityUrl,internalSecret,fetchImpl}),access=requirePermission('inventory.manage');
  app.use('/api/v1/jewelry/erp',erpRouter(options,auth,access));
  const handle=fn=>async(req,res)=>{try{const result=await fn(req);res.json(result);}catch(error){apiError(res,error);}};
 app.get('/api/v1/jewelry/openapi.json',(_req,res)=>res.sendFile(fileURLToPath(new URL('../../../docs/jewelry-openapi.json',import.meta.url))));
  app.get('/health',(_req,res)=>res.json({status:'ok',service:'jewelry'}));
  app.get('/internal/products/:id',(req,res,next)=>internalSecret&&req.get('x-internal-secret')===internalSecret?next():res.status(403).end(),handle(req=>service.product(uuid(req.get('x-service-tenant')),uuid(req.params.id))));
  app.get('/api/v1/jewelry/inventory',auth,access,handle(async req=>{
    const[pending]=await options.pool.execute("SELECT command FROM jewelry_operations WHERE tenant_id=? AND action='JewelryReceived' AND state='Pending' LIMIT 100",[req.identity.tenantId]);
    for(const {command}of pending){try{await service.confirmReceipt(command,await service.trace.request(`/internal/lot-operations/${command.operationId}`,{req}));}catch(error){if(![404,503].includes(error.status))throw error;}}
    return {materials:await service.inventory(req.identity.tenantId)};
  }));
  app.get('/api/v1/jewelry/products',auth,access,handle(async req=>({products:await service.products(req.identity.tenantId)})));
  app.get('/api/v1/jewelry/products/:id',auth,access,handle(req=>service.product(req.identity.tenantId,uuid(req.params.id))));
  app.post('/api/v1/jewelry/lots/:lotId/receipt',auth,access,handle(req=>{
    const command={...operationBody(req,'JewelryReceived'),qrLotId:uuid(req.body?.qrLotId)};
    if(command.qrLotId!==command.lotId)throw new OperationError(400,'QR_LOT_MISMATCH','El QR no corresponde al lote esperado para recepción');
    return service.receipt(command,req);
  }));
  app.post('/api/v1/jewelry/external-materials',auth,access,handle(req=>service.external({tenantId:req.identity.tenantId,actorId:req.identity.userId,operationId:uuid(req.body?.operationId),action:'ExternalMaterialDeclared',mineralType:text(req.body?.mineralType,'Mineral',80),source:text(req.body?.source,'Procedencia declarada'),weight:req.body?.weight,weightUnit:req.body?.weightUnit})));
  const allocate=req=>{
    const expectedVersion=req.params.id?version(req.body?.expectedVersion):0;
    return service.allocate({tenantId:req.identity.tenantId,actorId:req.identity.userId,operationId:uuid(req.body?.operationId),action:'CompositionAllocated',productId:req.params.id?uuid(req.params.id):null,expectedVersion,name:text(req.body?.name,'Nombre de joya',200),reason:text(req.body?.reason,'Motivo de composición'),allocations:req.body?.allocations});
  };
  app.post('/api/v1/jewelry/products',auth,access,handle(allocate));
  app.put('/api/v1/jewelry/products/:id/composition',auth,access,handle(allocate));
  return app;
}
