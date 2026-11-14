import { isDeepStrictEqual } from 'node:util';
import { ServiceClient } from '../../shared/infrastructure/http/ServiceClient.js';
import { OperationError } from '../../shared/application/OperationError.js';
import { evaluateEvidence,publicSummary } from './evidence.js';
export class CertificateService{
  constructor({pool,jewelryUrl,traceabilityUrl,internalSecret,fetchImpl=fetch}){this.pool=pool;this.jewelry=new ServiceClient({url:jewelryUrl,secret:internalSecret,fetchImpl});this.trace=new ServiceClient({url:traceabilityUrl,secret:internalSecret,fetchImpl});}
  async evidence(tenantId,productId){
    const product=await this.jewelry.request(`/internal/products/${productId}`,{tenantId}),graphs=new Map(),issues=[];
    for(const material of product.composition)if(material.lotId&&!graphs.has(material.lotId)){
      try{graphs.set(material.lotId,await this.trace.request(`/internal/certification/lots/${material.lotId}`,{tenantId}));}
      catch(error){if(error.status===409||error.status===404)issues.push({code:error.code,lotId:material.lotId});else throw error;}
    }
    const review=evaluateEvidence(product,graphs);review.issues.push(...issues);review.eligible=review.issues.length===0;
    return {product,graphs,...review};
  }
  async get(tenantId,id,db=this.pool){const[[row]]=await db.execute('SELECT * FROM certificates WHERE tenant_id=? AND id=?',[tenantId,id]);if(!row)throw new OperationError(404,'CERTIFICATE_NOT_FOUND','Certificado no encontrado');return row;}
  async list(tenantId,{productId,status}={}){const[rows]=await this.pool.execute('SELECT id,product_id AS productId,product_version AS productVersion,version,status,created_at AS createdAt,issued_at AS issuedAt FROM certificates WHERE tenant_id=? AND (? IS NULL OR product_id=?) AND (? IS NULL OR status=?) ORDER BY created_at DESC,id DESC',[tenantId,productId??null,productId??null,status??null,status??null]);return rows;}
  async mutate(command,apply){
    const tx=await this.pool.getConnection();
    try{await tx.beginTransaction();
      // Serialize per certificate, then recheck operation after acquiring its lock.
      if(command.action!=='Requested')await tx.execute('SELECT id FROM certificates WHERE tenant_id=? AND id=? FOR UPDATE',[command.tenantId,command.certificateId]);
      const[[old]]=await tx.execute('SELECT command,result FROM certificate_operations WHERE tenant_id=? AND operation_id=?',[command.tenantId,command.operationId]);
      if(old){if(!isDeepStrictEqual(old.command,command))throw new OperationError(409,'OPERATION_ID_REUSED','Identificador reutilizado');await tx.commit();return old.result;}
      const result=await apply(tx);
      await tx.execute('INSERT INTO certificate_operations(tenant_id,operation_id,certificate_id,actor_id,action,command,result) VALUES(?,?,?,?,?,?,?)',[command.tenantId,command.operationId,result.certificateId,command.actorId,command.action,JSON.stringify(command),JSON.stringify(result)]);
      await tx.commit();return result;
    }catch(error){await tx.rollback();if(error.code==='ER_DUP_ENTRY')return this.mutate(command,apply);throw error;}finally{tx.release();}
  }
  async request(command){
    return this.mutate(command,async tx=>{
      const evidence=await this.evidence(command.tenantId,command.productId),id=command.operationId;
      await tx.execute("INSERT INTO certificates(tenant_id,id,product_id,product_version,version,status,requested_by,published_summary) VALUES(?,?,?,?,1,'PendingReview',?,?)",[command.tenantId,id,command.productId,evidence.product.version,command.actorId,JSON.stringify(publicSummary(evidence.product,evidence.graphs))]);
      return {certificateId:id,status:'PendingReview',version:1,eligible:evidence.eligible,issues:evidence.issues};
    });
  }
  async review(command){return this.mutate(command,async tx=>{
    const cert=await this.get(command.tenantId,command.certificateId,tx);
    if(cert.version!==command.expectedVersion)throw new OperationError(409,'VERSION_CONFLICT','El certificado cambió');
    if(!['PendingReview','Rejected'].includes(cert.status))throw new OperationError(409,'INVALID_CERTIFICATE_STATE','El certificado ya fue resuelto');
    const evidence=await this.evidence(command.tenantId,cert.product_id);
    if(evidence.product.version!==cert.product_version)throw new OperationError(409,'COMPOSITION_CHANGED','Solicita una nueva revisión para la composición vigente');
    if(command.decision==='Issue'&&!evidence.eligible)throw new OperationError(409,'INSUFFICIENT_EVIDENCE',`La trazabilidad requiere revisión: ${[...new Set(evidence.issues.map(i=>i.code))].join(', ')}`);
    const status=command.decision==='Issue'?'Issued':'Rejected';
    const summary=publicSummary(evidence.product,evidence.graphs);if(status==='Issued')for(const material of summary.materials)material.evidenceLevel='Verified';
    await tx.execute('UPDATE certificates SET status=?,version=version+1,issuer_name=?,reviewed_by=?,evidence_hash=?,published_summary=?,issued_at=IF(?=\'Issued\',UTC_TIMESTAMP(3),NULL),updated_at=UTC_TIMESTAMP(3) WHERE tenant_id=? AND id=?',[status,command.issuerName,command.actorId,evidence.evidenceHash,JSON.stringify(summary),status,command.tenantId,command.certificateId]);
    return {certificateId:cert.id,status,version:cert.version+1,reviewReason:command.reason};
  });}
  async revoke(command){return this.mutate(command,async tx=>{
    const cert=await this.get(command.tenantId,command.certificateId,tx);
    if(cert.version!==command.expectedVersion)throw new OperationError(409,'VERSION_CONFLICT','El certificado cambió');
    if(cert.status!=='Issued')throw new OperationError(409,'INVALID_CERTIFICATE_STATE','Solo se revoca un certificado emitido');
    await tx.execute("UPDATE certificates SET status='Revoked',version=version+1,updated_at=UTC_TIMESTAMP(3) WHERE tenant_id=? AND id=?",[command.tenantId,cert.id]);
    return {certificateId:cert.id,status:'Revoked',version:cert.version+1,reason:command.reason,evidenceRef:command.evidenceRef};
  });}
  async publicStatus(id){
    const[[cert]]=await this.pool.execute('SELECT * FROM certificates WHERE id=?',[id]);if(!cert)throw new OperationError(404,'CERTIFICATE_NOT_FOUND','Certificado no encontrado');
    let status=cert.status,evidenceLevel='Insufficient';
    if(status==='Issued'){
      try{const evidence=await this.evidence(cert.tenant_id,cert.product_id);if(evidence.evidenceHash!==cert.evidence_hash||!evidence.eligible)status='ReviewRequired';else evidenceLevel='Verified';}
      catch{status='UnableToVerify';}
    }
    const summary=structuredClone(cert.published_summary);
    if(evidenceLevel!=='Verified')for(const material of summary.materials)if(material.evidenceLevel==='Verified')material.evidenceLevel='Declared';
    return {certificateId:id,status,evidenceLevel,issuer:cert.issuer_name??null,issuedAt:cert.issued_at,updatedAt:cert.updated_at,checkedAt:new Date().toISOString(),...summary};
  }
}
