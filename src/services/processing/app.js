import {fileURLToPath} from 'node:url';
import express from 'express';
import { createRemoteAuth } from '../../shared/infrastructure/http/remoteIdentity.js';
import { createSessionAuth } from '../../shared/infrastructure/http/sessionAuth.js';
import { requirePermission } from '../../shared/infrastructure/http/permissions.js';
import { operationBody,uuid,apiError,text } from '../../shared/infrastructure/http/operationHttp.js';
import { ProcessingService } from './ProcessingService.js';
export function createProcessingApp(options){
  const {identityUrl,internalSecret,appBaseUrl,fetchImpl=fetch}=options;
  const app=express();app.disable('x-powered-by');app.use(express.json());app.use(createSessionAuth({pool:null,appBaseUrl}).sameOrigin);
  const authenticate=createRemoteAuth({identityUrl,internalSecret,fetchImpl}),service=new ProcessingService(options);
 app.get('/api/v1/processing/openapi.json',(_req,res)=>res.sendFile(fileURLToPath(new URL('../../../docs/processing-openapi.json',import.meta.url))));
  app.get('/health',(_req,res)=>res.json({status:'ok',service:'processing'}));
  app.get('/api/v1/processing/lots/:lotId',authenticate,requirePermission('lots.read'),async(req,res)=>{try{res.json(await service.read(req.identity.tenantId,uuid(req.params.lotId),req));}catch(error){apiError(res,error);}});
  app.get('/api/v1/processing/lots/:lotId/genealogy',authenticate,requirePermission('lots.read'),async(req,res)=>{try{res.json(await service.trace.request(`/internal/lots/${uuid(req.params.lotId)}/genealogy`,{req}));}catch(error){apiError(res,error);}});
  const routes=[
    ['start','ProcessingStarted',()=>({})],
    ['assays','AssayRecorded',body=>({purity:body.purity,evidenceRef:text(body.evidenceRef,'Evidencia'),correctionOf:body.correctionOf??null,correctionReason:body.correctionReason?.trim()||null})],
    ['purification','PurificationRecorded',body=>({netWeight:body.netWeight,weightUnit:body.weightUnit,removedKind:body.removedKind,reason:body.reason?.trim()||null,evidenceRef:text(body.evidenceRef,'Evidencia')})],
    ['losses','TechnicalLossRecorded',body=>({lossWeight:body.lossWeight,weightUnit:body.weightUnit,reason:text(body.reason,'Motivo')})],
    ['transformations','LotsTransformed',body=>({inputs:body.inputs,plan:body.plan})],
    ['complete','ProcessingCompleted',body=>({reviewNote:text(body.reviewNote,'Revisión de etapas')})]
  ];
  for(const[path,action,payload]of routes)app.post(`/api/v1/processing/lots/:lotId/${path}`,authenticate,requirePermission('processing.manage'),async(req,res)=>{
    try{const command={...operationBody(req,action),...payload(req.body??{})};res.json(await service.execute(command,req));}catch(error){apiError(res,error);}});
  return app;
}
