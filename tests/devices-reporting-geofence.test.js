import {describe,test,expect,beforeAll,afterAll,jest} from '@jest/globals';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {serviceHarness} from './support/serviceHarness.js';
import {ReportingService} from '../src/services/reporting/ReportingService.js';
jest.setTimeout(90000);const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
suite('Sprint 3 advanced scope: devices, reports and geofence with eight owned databases',()=>{
 let h;beforeAll(async()=>{h=await serviceHarness();});afterAll(async()=>{await h?.close();});
 const op=()=>randomUUID();
 async function registerDevice(){const lot=await h.receivedLot();const device=await h.api('admin','post','/api/v1/devices',{operationId:op(),serial:'SCALE-'+op(),name:'Balanza de prueba',lotId:lot.lotId});return {...device,lotId:lot.lotId};}
 const readDevice=id=>h.api('admin','get','/api/v1/devices/'+id);
 const reading=(id,token,body)=>request(h.gateway).post(`/api/v1/devices/${id}/readings`).set('Authorization','Bearer '+token).send(body);
 test('US07 registration does not claim connectivity, rejects incompatible relinking and isolates tenants',async()=>{
  const lot=await h.receivedLot(),body={operationId:op(),serial:'SCALE-'+op(),name:'Nueva balanza',lotId:lot.lotId},created=await h.api('supervisor','post','/api/v1/devices',body);
  expect(created.connection).toBe('Unconfirmed');expect((await readDevice(created.deviceId)).connection).toBe('Unconfirmed');expect(await h.api('supervisor','post','/api/v1/devices',body)).toEqual(created);
  await h.api('admin','post','/api/v1/devices',{...body,operationId:op()},409);
  await h.api('foreign','get','/api/v1/devices/'+created.deviceId,undefined,404);
  await h.api('carrier','post','/api/v1/devices',{...body,operationId:op(),serial:op()},403);
 });
 test('US08 calibration keeps evidence, rejects reversed dates and marks expired or missing calibration',async()=>{
  const d=await registerDevice(),credential=await h.api('admin','post',`/api/v1/devices/${d.deviceId}/credentials`),id=d.deviceId;
  const current=()=>readDevice(id);
  await h.api('admin','post',`/api/v1/devices/${id}/calibrations`,{operationId:op(),expectedVersion:(await current()).version,calibratedAt:'2026-02-02T00:00:00Z',expiresAt:'2026-01-01T00:00:00Z',evidenceRef:'CAL-INVALID'},400);
  const now=Date.now();await h.api('supervisor','post',`/api/v1/devices/${id}/calibrations`,{operationId:op(),expectedVersion:(await current()).version,calibratedAt:new Date(now-86400000*2).toISOString(),expiresAt:new Date(now-86400000).toISOString(),evidenceRef:'CAL-EXPIRED'});
  const body={eventId:op(),weight:'50',weightUnit:'kg',battery:80},r=await reading(id,credential.token,body).expect(200);expect(r.body.calibrationStatus).toBe('Warning');
  expect((await reading(id,credential.token,body).expect(200)).body).toEqual(r.body);
  await reading(id,credential.token,{...body,weight:'51'}).expect(409);
  await h.api('supervisor','post',`/api/v1/devices/${id}/calibrations`,{operationId:op(),expectedVersion:(await current()).version,calibratedAt:new Date(now-3600000).toISOString(),expiresAt:new Date(now+86400000).toISOString(),evidenceRef:'CAL-CURRENT'});
  expect((await reading(id,credential.token,{...body,eventId:op()}).expect(200)).body.calibrationStatus).toBe('Current');
  expect((await current()).calibrations).toHaveLength(2);
  const[[stored]]=await h.runtimes.devices.pool.execute('SELECT credential_hash FROM devices WHERE id=?',[id]);expect(stored.credential_hash).not.toBe(credential.token);expect(stored.credential_hash).toHaveLength(64);
 });
 test('US09/11 stale communication opens one alert; fresh battery report resolves both alerts with recovery history',async()=>{
  const d=await registerDevice(),id=d.deviceId,{token}=await h.api('admin','post',`/api/v1/devices/${id}/credentials`);
  await reading(id,token,{eventId:op(),weight:'1',weightUnit:'kg',battery:14}).expect(200);
  let state=await readDevice(id);expect(state.connection).toBe('Online');expect(state.batteryCurrent).toBe(true);expect(state.alerts.filter(a=>a.kind==='LowBattery'&&!a.resolvedAt)).toHaveLength(1);
  await h.runtimes.devices.pool.execute('UPDATE devices SET last_communication=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 301 SECOND),battery_reported_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 301 SECOND) WHERE id=?',[id]);
  state=await readDevice(id);await readDevice(id);expect(state.connection).toBe('Disconnected');expect(state.batteryCurrent).toBe(false);expect(state.alerts.filter(a=>a.kind==='Disconnected'&&!a.resolvedAt)).toHaveLength(1);
  await reading(id,token,{eventId:op(),weight:'1',weightUnit:'kg',battery:16}).expect(200);state=await readDevice(id);
  expect(state.alerts.every(a=>a.resolvedAt)).toBe(true);expect(state.audit.filter(a=>a.action==='AlertRecovered')).toHaveLength(2);
 });
 test('US10 deactivation requires operational acknowledgement and preserves readings and rejection reason',async()=>{
  const d=await registerDevice(),id=d.deviceId,{token}=await h.api('admin','post',`/api/v1/devices/${id}/credentials`);
  await reading(id,token,{eventId:op(),weight:'1',weightUnit:'kg',battery:90}).expect(200);
  const body={operationId:op(),expectedVersion:(await readDevice(id)).version,reason:'Sello comprometido',acknowledgeOperationalImpact:false};
  await h.api('admin','post',`/api/v1/devices/${id}/deactivation`,body,409);
  await h.api('admin','post',`/api/v1/devices/${id}/deactivation`,{...body,operationId:op(),acknowledgeOperationalImpact:true});
  await reading(id,token,{eventId:op(),weight:'1',weightUnit:'kg',battery:90}).expect(409);
  const state=await readDevice(id);expect(state.readings).toHaveLength(1);expect(state.connection).toBe('Disabled');expect(state.audit.find(a=>a.action==='ReadingRejected').payload.reason).toBe('Sello comprometido');
 });
 test('device rotation rejects the old token and a device cannot impersonate another device',async()=>{
  const a=await registerDevice(),b=await registerDevice(),first=await h.api('admin','post',`/api/v1/devices/${a.deviceId}/credentials`),second=await h.api('admin','post',`/api/v1/devices/${a.deviceId}/credentials`),body={eventId:op(),weight:'1',weightUnit:'kg',battery:90};
  await reading(a.deviceId,first.token,body).expect(401);await reading(b.deviceId,second.token,body).expect(401);await reading(a.deviceId,second.token,{...body,battery:101}).expect(400);
 });
 const vertices=[{latitude:-13,longitude:-77},{latitude:-13,longitude:-76},{latitude:-12,longitude:-76},{latitude:-12,longitude:-77}];
 test('US13 records identified polygon/source, blocks outside approval and never auto-approves an inside point',async()=>{
  const concession=await h.api('supervisor','post','/api/v1/geofences',{operationId:op(),name:'Concesión de prueba',polygon:vertices,source:'Fuente cartográfica de prueba',authorizationRef:'AUT-TEST',confirmAuthorization:true}),lot=await h.receivedLot();
  const path=`/api/v1/lots/${lot.lotId}/geofence`;
  const outside=await h.api('certifier','post',path,{operationId:op(),expectedVersion:lot.version,concessionId:concession.concessionId,location:{latitude:-15,longitude:-77},reason:'Contraste inicial'});expect(outside.status).toBe('Outside');expect(outside.source).toBe('Fuente cartográfica de prueba');
  await h.api('certifier','post',`/api/v1/lots/${lot.lotId}/evidence-review`,{operationId:op(),expectedVersion:outside.version,reviewStatus:'Verified',reason:'No permitido'},409);
  const inside=await h.api('certifier','post',path,{operationId:op(),expectedVersion:outside.version,concessionId:concession.concessionId,location:{latitude:-12.5,longitude:-76.5},reason:'Corrección documentada de ubicación'});expect(inside.status).toBe('Inside');expect(inside.originApproved).toBe(false);expect((await h.current(lot.lotId)).originEvidenceStatus).toBe('PendingReview');
  await h.api('certifier','post',`/api/v1/lots/${lot.lotId}/evidence-review`,{operationId:op(),expectedVersion:inside.version,reviewStatus:'Verified',reason:'Documentos y ubicación cotejados'});
  const read=await h.api('certifier','get',path);expect(read.history).toHaveLength(2);
  await h.api('foreign','get',path,undefined,404);
 });
 test('US13 offline location declarations survive sync as pending until a polygon is checked',async()=>{
  const event={clientEventId:op(),eventType:'LotRegistered',occurredAt:new Date().toISOString(),dependencies:[],payload:{mineralType:'Gold',weight:'1',weightUnit:'kg',originEvidence:{reference:'GEO-PENDING',source:'Declarada'},location:null,concessionId:op()}};
  const sync=await h.api('supervisor','post','/api/v1/events/synchronize',{sourceId:'offline-geo-test',events:[event]});const lotId=sync.results[0].lotId;
  const state=await h.api('supervisor','get',`/api/v1/lots/${lotId}/geofence`);expect(state.status).toBe('PendingCheck');expect(state.capture.concessionId).toBe(event.payload.concessionId);
  await h.api('certifier','post',`/api/v1/lots/${lotId}/evidence-review`,{operationId:op(),expectedVersion:1,reviewStatus:'Verified',reason:'Sin geocerca'},409);
 });
 test('US45 central dashboard contains only accepted server facts with timestamp, own tenant and zero on empty tenant',async()=>{
  const dashboard=await h.api('supervisor','get','/api/v1/reporting/dashboard');expect(dashboard.total).toBeGreaterThan(0);expect(dashboard.updatedAt).toMatch(/Z$/);expect(dashboard.snapshotId).toBeTruthy();
  const empty=await h.api('foreign','get','/api/v1/reporting/dashboard');expect(empty.total).toBe(0);expect(empty.active).toBe(0);expect(Object.values(empty.states).every(n=>n===0)).toBe(true);
  await h.api('carrier','get','/api/v1/reporting/dashboard',undefined,403);
 });
 test('US46 reports exact weighted technical loss by period and excludes impurities',async()=>{
  const a=await h.receivedLot({weight:'100'}),b=await h.receivedLot({weight:'900'});
  for(const lot of[a,b])await h.processing(lot.lotId,'start');
  await h.processing(a.lotId,'losses',{lossWeight:'10',weightUnit:'kg',reason:'Pérdida de proceso A'});
  await h.processing(b.lotId,'losses',{lossWeight:'9',weightUnit:'kg',reason:'Pérdida de proceso B'});
  await h.processing(b.lotId,'purification',{netWeight:'880',weightUnit:'kg',removedKind:'Impurities',reason:'Impurezas separadas',evidenceRef:'PROC-IMP'});
  const from=new Date(Date.now()-3600000).toISOString(),to=new Date(Date.now()+3600000).toISOString(),report=await h.api('plant','get','/api/v1/reporting/losses?'+new URLSearchParams({from,to}));
  expect(report.operations).toHaveLength(2);expect(report.weightedLossPercentage).toBe('1.9');expect(report.inputGrams).toBe('1000000');expect(report.lossGrams).toBe('19000');expect(report.operations.filter(o=>o.critical)).toHaveLength(1);
  await h.api('plant','get','/api/v1/reporting/losses?from=bad&to=bad',undefined,400);
 });
 test('US47 exports authorized sources/review labels, neutralizes formulas and recovers deferred jobs after restart',async()=>{
  await h.receivedLot({source:'=HYPERLINK("https://example.test","bad")'});
  const from=new Date(Date.now()-3600000).toISOString(),to=new Date(Date.now()+3600000).toISOString(),created=await h.api('supervisor','post','/api/v1/reporting/exports',{operationId:op(),from,to});expect(created.state).toBe('Ready');
  const csv=await request(h.gateway).get(created.downloadUrl).set('Cookie',h.cookies.supervisor).expect(200);expect(csv.text).toContain("'=HYPERLINK");expect(csv.text).toContain('PendingReview');expect(csv.text).toContain('no acredita por sí sola');
  await h.api('foreign','get',created.downloadUrl,undefined,404);
  const service=new ReportingService({pool:h.runtimes.reporting.pool,traceabilityUrl:h.urls.traceability,internalSecret:h.internalSecret}),long=await service.requestExport({tenantId:h.tenantId,actorId:h.users.admin,operationId:op(),action:'EvidenceExportRequested',from:'2020-01-01T00:00:00Z',to:'2030-01-01T00:00:00Z'});expect(long.deferred).toBe(true);
  const restarted=new ReportingService({pool:h.runtimes.reporting.pool,traceabilityUrl:h.urls.traceability,internalSecret:h.internalSecret});await restarted.resume();expect((await restarted.status(h.tenantId,long.exportId)).state).toBe('Ready');
 });
});
