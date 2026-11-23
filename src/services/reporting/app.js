import {fileURLToPath} from 'node:url';
import express from 'express';
import {createRemoteAuth} from '../../shared/infrastructure/http/remoteIdentity.js';
import {createSessionAuth} from '../../shared/infrastructure/http/sessionAuth.js';
import {requirePermission} from '../../shared/infrastructure/http/permissions.js';
import {uuid,apiError} from '../../shared/infrastructure/http/operationHttp.js';
import {ReportingService} from './ReportingService.js';
export function createReportingApp(options){
 const{identityUrl,internalSecret,appBaseUrl,fetchImpl=fetch}=options,app=express(),service=new ReportingService(options);
 app.disable('x-powered-by');app.use(express.json());app.use(createSessionAuth({pool:null,appBaseUrl}).sameOrigin);app.locals.reportingService=service;
 const auth=createRemoteAuth({identityUrl,internalSecret,fetchImpl}),handle=fn=>async(req,res)=>{try{res.set('Cache-Control','no-store');res.json(await fn(req));}catch(error){apiError(res,error);}};
 app.get('/api/v1/reporting/openapi.json',(_req,res)=>res.sendFile(fileURLToPath(new URL('../../../docs/reporting-openapi.json',import.meta.url))));
 app.get('/health',(_req,res)=>res.json({status:'ok',service:'reporting'}));
 app.get('/api/v1/reporting/dashboard',auth,requirePermission('reporting.read'),handle(req=>service.dashboard(req.identity.tenantId)));
 app.get('/api/v1/reporting/losses',auth,requirePermission('reporting.read'),handle(req=>service.losses(req.identity.tenantId,req.query.from,req.query.to)));
 app.get('/api/v1/reporting/exports',auth,requirePermission('reporting.export'),handle(async req=>{
  const[rows]=await options.pool.execute('SELECT id FROM evidence_exports WHERE tenant_id=? ORDER BY created_at DESC,id DESC LIMIT 100',[req.identity.tenantId]);
  return {exports:await Promise.all(rows.map(row=>service.status(req.identity.tenantId,row.id)))};
 }));
 app.post('/api/v1/reporting/exports',auth,requirePermission('reporting.export'),async(req,res)=>{try{
  const result=await service.requestExport({tenantId:req.identity.tenantId,actorId:req.identity.userId,operationId:uuid(req.body?.operationId),action:'EvidenceExportRequested',from:req.body?.from,to:req.body?.to});
  if(!result.deferred)await service.process(req.identity.tenantId,result.exportId);else void service.process(req.identity.tenantId,result.exportId);
  res.status(result.deferred?202:200).set('Cache-Control','no-store').json({...result,...await service.status(req.identity.tenantId,result.exportId)});
 }catch(error){apiError(res,error);}});
 app.get('/api/v1/reporting/exports/:id',auth,requirePermission('reporting.export'),handle(req=>service.status(req.identity.tenantId,uuid(req.params.id))));
 app.get('/api/v1/reporting/exports/:id/download',auth,requirePermission('reporting.export'),async(req,res)=>{try{
  res.set('Cache-Control','no-store');const id=uuid(req.params.id),row=await service.export(req.identity.tenantId,id);
  if(row.state!=='Ready'){void service.process(req.identity.tenantId,id);return res.status(202).set('Retry-After','2').json({state:'Pending'});}
  res.type('text/csv; charset=utf-8').set('Content-Disposition',`attachment; filename="eventore-evidence-${id}.csv"`).send(row.content);
 }catch(error){apiError(res,error);}});
 return app;
}
