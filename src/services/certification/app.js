import {fileURLToPath} from 'node:url';
import express from 'express';
import { createRemoteAuth } from '../../shared/infrastructure/http/remoteIdentity.js';
import { createSessionAuth } from '../../shared/infrastructure/http/sessionAuth.js';
import { requirePermission } from '../../shared/infrastructure/http/permissions.js';
import { uuid,text,version,apiError } from '../../shared/infrastructure/http/operationHttp.js';
import { CertificateService } from './CertificateService.js';
import { CertificatePdfJobs } from './CertificatePdf.js';
import { OperationError } from '../../shared/application/OperationError.js';
export function createCertificationApp(options){
  const{identityUrl,internalSecret,appBaseUrl,fetchImpl=fetch}=options,app=express(),service=new CertificateService(options),pdf=new CertificatePdfJobs({...options,service});
  app.disable('x-powered-by');app.use(express.json());app.use(createSessionAuth({pool:null,appBaseUrl}).sameOrigin);
  const auth=createRemoteAuth({identityUrl,internalSecret,fetchImpl}),handle=fn=>async(req,res)=>{try{res.set('Cache-Control','no-store');res.json(await fn(req));}catch(error){apiError(res,error);}};
 app.get('/api/v1/certificates/openapi.json',(_req,res)=>res.sendFile(fileURLToPath(new URL('../../../docs/certification-openapi.json',import.meta.url))));
  app.get('/health',(_req,res)=>res.json({status:'ok',service:'certification'}));
  app.get('/api/v1/public/certificates/:id',handle(req=>service.publicStatus(uuid(req.params.id))));
  app.get('/api/v1/certificates',auth,requirePermission('certificates.read'),handle(async req=>({certificates:await service.list(req.identity.tenantId,{productId:req.query.productId?uuid(req.query.productId):undefined,status:req.query.status})})));
  app.get('/api/v1/certificates/:id/eligibility',auth,requirePermission('certificates.review'),handle(async req=>{
    const cert=await service.get(req.identity.tenantId,uuid(req.params.id)),result=await service.evidence(req.identity.tenantId,cert.product_id);
    return {eligible:result.eligible&&result.product.version===cert.product_version,issues:result.product.version===cert.product_version?result.issues:[...result.issues,{code:'COMPOSITION_CHANGED'}],evidenceVersion:result.evidenceHash,productVersion:result.product.version};
  }));
  app.get('/api/v1/certificates/:id',auth,requirePermission('certificates.read'),handle(async req=>{
    const cert=await service.get(req.identity.tenantId,uuid(req.params.id)),[history]=await options.pool.execute('SELECT actor_id AS actorId,action,command,result,occurred_at AS occurredAt FROM certificate_operations WHERE tenant_id=? AND certificate_id=? ORDER BY occurred_at,operation_id',[req.identity.tenantId,cert.id]);
    return {certificateId:cert.id,productId:cert.product_id,productVersion:cert.product_version,version:cert.version,status:cert.status,current:await service.publicStatus(cert.id),history};
  }));
  const command=(req,action)=>({tenantId:req.identity.tenantId,actorId:req.identity.userId,operationId:uuid(req.body?.operationId),action,...(req.params.id?{certificateId:uuid(req.params.id),expectedVersion:version(req.body?.expectedVersion)}:{})});
  app.post('/api/v1/certificates',auth,requirePermission('certificates.request'),handle(req=>service.request({...command(req,'Requested'),productId:uuid(req.body?.productId)})));
  app.post('/api/v1/certificates/:id/review',auth,requirePermission('certificates.review'),handle(req=>{
    if(!['Issue','Reject'].includes(req.body?.decision))throw new OperationError(400,'INVALID_DECISION','Selecciona emitir o rechazar');
    return service.review({...command(req,'Reviewed'),decision:req.body.decision,issuerName:text(req.body?.issuerName,'Emisor',200),reason:text(req.body?.reason,'Motivo de revisión')});
  }));
  app.post('/api/v1/certificates/:id/revoke',auth,requirePermission('certificates.revoke'),handle(req=>service.revoke({...command(req,'Revoked'),reason:text(req.body?.reason,'Motivo de revocación'),evidenceRef:text(req.body?.evidenceRef,'Referencia de evidencia')})));
  app.get('/api/v1/certificates/:id/pdf',auth,requirePermission('certificates.read'),async(req,res)=>{
    try{res.set('Cache-Control','no-store');const id=uuid(req.params.id),job=await pdf.get(req.identity.tenantId,id);
      if(job.state==='Ready')return res.type('application/pdf').set('Content-Disposition',`attachment; filename="eventore-${id}.pdf"`).send(job.content);
      res.status(job.state==='Failed'?503:202).set('Retry-After','2').json({state:job.state,downloadUrl:`/api/v1/certificates/${id}/pdf`});
    }catch(error){apiError(res,error);}
  });
  return app;
}
