import {describe,test,expect,beforeAll,afterAll,jest} from '@jest/globals';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {serviceHarness} from './support/serviceHarness.js';
import {CertificateService} from '../src/services/certification/CertificateService.js';
import {CertificatePdfJobs,renderCertificatePdf} from '../src/services/certification/CertificatePdf.js';
jest.setTimeout(90000);
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
suite('Sprint 3 jewelry, certification and public verification across six databases',()=>{
 let h;beforeAll(async()=>{h=await serviceHarness();});afterAll(async()=>{await h?.close();});
 async function material({verified=true,weight='10'}={}){
  const lot=await h.receivedLot({weight});await h.processing(lot.lotId,'start');
  await h.processing(lot.lotId,'assays',{purity:'99.5',evidenceRef:'LAB-S3'});
  await h.processing(lot.lotId,'purification',{netWeight:weight,weightUnit:'kg',removedKind:'Impurities',evidenceRef:'PROC-S3'});
  await h.processing(lot.lotId,'complete',{reviewNote:'Etapas, análisis y balance revisados'});
  if(verified)await h.api('certifier','post',`/api/v1/lots/${lot.lotId}/evidence-review`,{operationId:randomUUID(),expectedVersion:(await h.current(lot.lotId)).version,reviewStatus:'Verified',reason:'Origen, análisis y proceso cotejados'});
  const receipt=await h.api('jeweler','post',`/api/v1/jewelry/lots/${lot.lotId}/receipt`,{operationId:randomUUID(),expectedVersion:(await h.current(lot.lotId)).version});
  return receipt;
 }
 const allocation=(materialId,weight='1')=>({materialId,weight,weightUnit:'kg'});
 const product=async(materialId,weight='1')=>h.api('jeweler','post','/api/v1/jewelry/products',{operationId:randomUUID(),name:'Anillo de prueba',reason:'Fabricación inicial documentada',allocations:[allocation(materialId,weight)]});
 const certificate=async productId=>h.api('jeweler','post','/api/v1/certificates',{operationId:randomUUID(),productId});
 const issue=async cert=>h.api('certifier','post',`/api/v1/certificates/${cert.certificateId}/review`,{operationId:randomUUID(),expectedVersion:cert.version,decision:'Issue',issuerName:'Laboratorio EventOre de prueba',reason:'Genealogía y evidencias revisadas'});
 const publicly=async id=>(await request(h.gateway).get(`/api/v1/public/certificates/${id}`).expect(200)).body;
 test('receipt only accepts Processed once and preserves declared evidence classification',async()=>{
  const lot=await h.receivedLot();await h.api('jeweler','post',`/api/v1/jewelry/lots/${lot.lotId}/receipt`,{operationId:randomUUID(),expectedVersion:lot.version},409);
  const received=await material({verified:false});expect(received.originEvidenceStatus).toBe('PendingReview');
  await h.api('jeweler','post',`/api/v1/jewelry/lots/${received.lotId}/receipt`,{operationId:randomUUID(),expectedVersion:received.version},409);
  const inventory=await h.api('jeweler','get','/api/v1/jewelry/inventory');expect(inventory.materials.find(m=>m.id===received.materialId).category).toBe('Declared');
  const p=await product(received.materialId),cert=await certificate(p.productId);expect(cert.status).toBe('PendingReview');expect(cert.eligible).toBe(false);
  await h.api('certifier','post',`/api/v1/certificates/${cert.certificateId}/review`,{operationId:randomUUID(),expectedVersion:1,decision:'Issue',issuerName:'No aprobado',reason:'Intento sin evidencia'},409);
  expect((await publicly(cert.certificateId)).evidenceLevel).toBe('Insufficient');
 });
 test('external material stays External and cannot mix with either documented or declared stock',async()=>{
  const ext=await h.api('jeweler','post','/api/v1/jewelry/external-materials',{operationId:randomUUID(),mineralType:'Gold',weight:'20',weightUnit:'kg',source:'Proveedor externo; declaración pendiente',category:'Documented'});
  expect(ext.category).toBe('External');
  for(const verified of [true,false]){const received=await material({verified});await h.api('jeweler','post','/api/v1/jewelry/products',{operationId:randomUUID(),name:'Mezcla',reason:'Intento',allocations:[allocation(ext.materialId),allocation(received.materialId)]},409);}
  const p=await product(ext.materialId),cert=await certificate(p.productId);expect(cert.issues.some(i=>i.code==='UNVERIFIED_EXTERNAL_MATERIAL')).toBe(true);
 });
 test('concurrent allocations cannot overspend and correction preserves history and returns replaced stock',async()=>{
  const received=await material({weight:'1'}),commands=[1,2].map(()=>({operationId:randomUUID(),name:'Asignación concurrente',reason:'Fabricación',allocations:[allocation(received.materialId,'0.75')]}));
  const responses=await Promise.all(commands.map(body=>request(h.gateway).post('/api/v1/jewelry/products').set('Cookie',h.cookies.jeweler).send(body)));
  expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
  const accepted=responses.find(r=>r.status===200).body,index=responses.findIndex(r=>r.status===200);
  expect(await h.api('jeweler','post','/api/v1/jewelry/products',commands[index])).toEqual(accepted);
  await h.api('jeweler','put',`/api/v1/jewelry/products/${accepted.productId}/composition`,{operationId:randomUUID(),expectedVersion:1,name:'Corregida',reason:'Ajuste de fabricación',allocations:[allocation(received.materialId,'0.5')]});
  const detail=await h.api('jeweler','get',`/api/v1/jewelry/products/${accepted.productId}`);expect(detail.history).toHaveLength(2);expect(detail.history[1].beforeComposition[0].quantityGrams).toBe('750');
  const inventory=await h.api('jeweler','get','/api/v1/jewelry/inventory');expect(inventory.materials.find(m=>m.id===received.materialId).availableGrams).toBe('500');
 });
 test('issue produces a real PDF, public whitelist and revocation updates an existing QR',async()=>{
  const received=await material(),p=await product(received.materialId),cert=await certificate(p.productId);expect(cert.eligible).toBe(true);
  const issued=await issue(cert);expect(issued.status).toBe('Issued');
  const publicView=await publicly(cert.certificateId);expect(publicView.status).toBe('Issued');expect(publicView.materials[0].evidenceLevel).toBe('Verified');
  const json=JSON.stringify(publicView);for(const privateValue of [h.tenantId,h.users.certifier,'LAB-S3','SOURCE-001','@example.test','actorId','originSource','evidenceReference'])expect(json).not.toContain(privateValue);
  const pdf=await request(h.gateway).get(`/api/v1/certificates/${cert.certificateId}/pdf`).set('Cookie',h.cookies.jeweler).expect(200);expect(pdf.headers['content-type']).toContain('application/pdf');expect(pdf.body.subarray(0,5).toString()).toBe('%PDF-');
  await h.api('foreign','get',`/api/v1/certificates/${cert.certificateId}/pdf`,undefined,404);
  await h.api('jeweler','post',`/api/v1/certificates/${cert.certificateId}/revoke`,{operationId:randomUUID(),expectedVersion:issued.version,reason:'No autorizado',evidenceRef:'REV-0'},403);
  const revoked=await h.api('admin','post',`/api/v1/certificates/${cert.certificateId}/revoke`,{operationId:randomUUID(),expectedVersion:issued.version,reason:'Hallazgo posterior documentado',evidenceRef:'REV-1'});expect(revoked.status).toBe('Revoked');expect((await publicly(cert.certificateId)).status).toBe('Revoked');
  await h.api('jeweler','get',`/api/v1/certificates/${cert.certificateId}/pdf`,undefined,409);
  const filtered=await h.api('jeweler','get',`/api/v1/certificates?productId=${p.productId}&status=Revoked`);expect(filtered.certificates).toHaveLength(1);
 });
 test('composition or source changes invalidate prior issuance; outages never return a valid cached status',async()=>{
  const received=await material(),p=await product(received.materialId),cert=await certificate(p.productId);await issue(cert);
  await h.api('jeweler','put',`/api/v1/jewelry/products/${p.productId}/composition`,{operationId:randomUUID(),expectedVersion:1,name:'Corrección de composición',reason:'Cambio de fabricación',allocations:[allocation(received.materialId,'0.5')]});
  expect((await publicly(cert.certificateId)).status).toBe('ReviewRequired');
  const second=await certificate(p.productId);await issue(second);
  await h.api('certifier','post',`/api/v1/lots/${received.lotId}/evidence-review`,{operationId:randomUUID(),expectedVersion:(await h.current(received.lotId)).version,reviewStatus:'Rejected',reason:'Revisión posterior desfavorable'});
  expect((await publicly(second.certificateId)).status).toBe('ReviewRequired');
  const service=new CertificateService({pool:h.runtimes.certification.pool,jewelryUrl:h.urls.jewelry,traceabilityUrl:h.urls.traceability,internalSecret:h.internalSecret,fetchImpl:async()=>{throw Error('offline');}});
  expect((await service.publicStatus(second.certificateId)).status).toBe('UnableToVerify');
 });
 test('incomplete/cyclic genealogy blocks issuance and PDF jobs stay retrievable when generation is slow',async()=>{
  const received=await material(),p=await product(received.materialId),cert=await certificate(p.productId);await issue(cert);
  const service=new CertificateService({pool:h.runtimes.certification.pool,jewelryUrl:h.urls.jewelry,traceabilityUrl:h.urls.traceability,internalSecret:h.internalSecret});
  let finish;const gate=new Promise(resolve=>{finish=resolve;});
  const jobs=new CertificatePdfJobs({pool:h.runtimes.certification.pool,service,appBaseUrl:'http://localhost:4173',waitMs:5,render:async(...args)=>{await gate;return renderCertificatePdf(...args);}});
  expect((await jobs.get(h.tenantId,cert.certificateId)).state).toBe('Pending');finish();await Promise.all([...jobs.active.values()]);expect((await jobs.get(h.tenantId,cert.certificateId)).state).toBe('Ready');
  await h.runtimes.traceability.pool.execute('INSERT INTO lot_lineage(tenant_id,parent_lot_id,child_lot_id,operation_id) VALUES(?,?,?,?)',[h.tenantId,received.lotId,received.lotId,randomUUID()]);
  expect((await publicly(cert.certificateId)).status).toBe('ReviewRequired');
  const blocked=await certificate(p.productId);expect(blocked.issues.some(i=>i.code==='CYCLIC_GENEALOGY')).toBe(true);
 });
});
