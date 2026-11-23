import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {LocalCommands} from '../../shared/infrastructure/persistence/LocalCommands.js';
import {ServiceClient} from '../../shared/infrastructure/http/ServiceClient.js';
import {OperationError} from '../../shared/application/OperationError.js';
import {mass,formatMass} from '../../shared/domain/decimalMass.js';
import {uuid,text} from '../../shared/infrastructure/http/operationHttp.js';
const digest=value=>createHash('sha256').update(value).digest('hex');
const fail=(code,message,status=409)=>{throw new OperationError(status,code,message);};
export class DeviceService{
 constructor({pool,traceabilityUrl,internalSecret,fetchImpl=fetch,clock=()=>new Date()}){Object.assign(this,{pool,clock});this.commands=new LocalCommands(pool,'device_operations');this.trace=new ServiceClient({url:traceabilityUrl,secret:internalSecret,fetchImpl});}
 async device(tenantId,id,db=this.pool,lock=false){const[[device]]=await db.execute(`SELECT * FROM devices WHERE tenant_id=? AND id=?${lock?' FOR UPDATE':''}`,[tenantId,id]);if(!device)fail('DEVICE_NOT_FOUND','Dispositivo no encontrado',404);return device;}
 async audit(tx,device,action,payload,actorId=null){await tx.execute('INSERT INTO device_audit(id,tenant_id,device_id,actor_id,action,payload) VALUES(?,?,?,?,?,?)',[randomUUID(),device.tenant_id,device.id,actorId,action,JSON.stringify(payload)]);}
 async register(command,req){
  if(!/^[A-Za-z0-9._:-]{1,100}$/.test(command.serial))fail('INVALID_SERIAL','El identificador admite letras, números, punto, guion y dos puntos',400);
  await this.trace.request(`/internal/lots/${command.lotId}/state`,{req});
  try{return await this.commands.run(command,async tx=>{
   const[[existing]]=await tx.execute('SELECT id FROM devices WHERE serial=? FOR UPDATE',[command.serial]);if(existing)fail('DEVICE_ALREADY_LINKED','El dispositivo ya tiene una vinculación incompatible');
   await tx.execute('INSERT INTO devices(id,tenant_id,serial,name,operation_lot_id,version) VALUES(?,?,?,?,?,1)',[command.operationId,command.tenantId,command.serial,command.name,command.lotId]);
   await this.audit(tx,{id:command.operationId,tenant_id:command.tenantId},'Registered',{lotId:command.lotId,serial:command.serial},command.actorId);
   return {deviceId:command.operationId,version:1,connection:'Unconfirmed'};
  });}catch(error){if(error.code==='ER_DUP_ENTRY')fail('DEVICE_ALREADY_LINKED','El dispositivo ya tiene una vinculación incompatible');throw error;}
 }
 async change(command){return this.commands.run(command,async tx=>{
  const device=await this.device(command.tenantId,command.deviceId,tx,true);if(device.version!==command.expectedVersion)fail('VERSION_CONFLICT','El dispositivo cambió; vuelve a consultarlo');
  if(!device.active)fail('DEVICE_DISABLED','El dispositivo está desactivado');
  if(command.action==='Calibrated'){
   const calibratedAt=new Date(command.calibratedAt),expiresAt=new Date(command.expiresAt);
   if(!Number.isFinite(+calibratedAt)||!Number.isFinite(+expiresAt)||expiresAt<=calibratedAt)fail('INVALID_CALIBRATION_DATES','La vigencia debe terminar después de la fecha de calibración',400);
   await tx.execute('INSERT INTO device_calibrations(tenant_id,id,device_id,calibrated_at,expires_at,evidence_ref,actor_id) VALUES(?,?,?,?,?,?,?)',[command.tenantId,command.operationId,device.id,calibratedAt,expiresAt,text(command.evidenceRef,'Evidencia de calibración'),command.actorId]);
  }else if(command.action==='Disabled'){
   if(command.acknowledgeOperationalImpact!==true)fail('OPERATIONAL_IMPACT_ACK_REQUIRED','Confirma el efecto sobre la operación vinculada antes de desactivar');
   await tx.execute('UPDATE devices SET active=false,disabled_reason=? WHERE id=?',[text(command.reason,'Motivo de desactivación'),device.id]);
   await tx.execute('UPDATE device_alerts SET resolved_at=? WHERE tenant_id=? AND device_id=? AND resolved_at IS NULL',[this.clock(),command.tenantId,device.id]);
  }else fail('INVALID_ACTION','Acción no reconocida',400);
  await tx.execute('UPDATE devices SET version=version+1 WHERE id=?',[device.id]);await this.audit(tx,device,command.action,command,command.actorId);
  return {deviceId:device.id,version:device.version+1,action:command.action};
 });}
 async credential(tenantId,id,actorId){const tx=await this.pool.getConnection();try{await tx.beginTransaction();const device=await this.device(tenantId,id,tx,true);if(!device.active)fail('DEVICE_DISABLED','El dispositivo está desactivado');
  const token=randomBytes(32).toString('base64url');await tx.execute('UPDATE devices SET credential_hash=?,version=version+1 WHERE id=?',[digest(token),id]);await this.audit(tx,device,'CredentialRotated',{previousCredentialRevoked:true},actorId);await tx.commit();return {deviceId:id,token,version:device.version+1,notice:'La credencial solo se muestra ahora. La anterior quedó revocada.'};
 }catch(error){await tx.rollback();throw error;}finally{tx.release();}}
 async alert(tx,device,kind,active,details){const[[open]]=await tx.execute('SELECT id FROM device_alerts WHERE tenant_id=? AND device_id=? AND kind=? AND resolved_at IS NULL',[device.tenant_id,device.id,kind]);
  if(active&&!open)await tx.execute('INSERT INTO device_alerts(id,tenant_id,device_id,kind,details,opened_at) VALUES(?,?,?,?,?,?)',[randomUUID(),device.tenant_id,device.id,kind,JSON.stringify(details),this.clock()]);
  if(!active&&open){await tx.execute('UPDATE device_alerts SET resolved_at=? WHERE id=?',[this.clock(),open.id]);await this.audit(tx,device,'AlertRecovered',{alertId:open.id,kind});}
 }
 async ingest(id,token,body){
  if(typeof token!=='string'||token.length>100)fail('INVALID_DEVICE_CREDENTIAL','Credencial de dispositivo inválida',401);
  const tx=await this.pool.getConnection();try{await tx.beginTransaction();const[[device]]=await tx.execute('SELECT * FROM devices WHERE id=? AND credential_hash=? FOR UPDATE',[id,digest(token)]);if(!device)fail('INVALID_DEVICE_CREDENTIAL','Credencial de dispositivo inválida',401);
   if(!device.active){await this.audit(tx,device,'ReadingRejected',{reason:device.disabled_reason});await tx.commit();fail('DEVICE_DISABLED','La medición se rechazó porque el dispositivo está desactivado');}
   const eventId=uuid(body.eventId),payload={eventId,weight:body.weight,weightUnit:body.weightUnit,battery:body.battery};
   mass(payload.weight,payload.weightUnit);if(!Number.isInteger(payload.battery)||payload.battery<0||payload.battery>100)fail('INVALID_BATTERY','La batería debe estar entre 0 y 100',400);
   const[[old]]=await tx.execute('SELECT payload,result FROM device_readings WHERE tenant_id=? AND device_id=? AND event_id=?',[device.tenant_id,id,eventId]);if(old){if(!isDeepStrictEqual(old.payload,payload))fail('EVENT_ID_REUSED','El evento ya tiene otros datos');await tx.commit();return old.result;}
   const now=this.clock(),[[calibration]]=await tx.execute('SELECT id,expires_at FROM device_calibrations WHERE tenant_id=? AND device_id=? AND calibrated_at<=? ORDER BY calibrated_at DESC,created_at DESC LIMIT 1',[device.tenant_id,id,now]);
   const result={deviceId:id,eventId,receivedAt:now.toISOString(),weight:payload.weight,weightUnit:payload.weightUnit,battery:payload.battery,calibrationStatus:calibration&&new Date(calibration.expires_at)>now?'Current':'Warning',calibrationId:calibration?.id??null,warning:calibration&&new Date(calibration.expires_at)>now?null:'Calibración ausente o vencida; la medición requiere revisión'};
   await tx.execute('INSERT INTO device_readings(tenant_id,device_id,event_id,payload,result,received_at) VALUES(?,?,?,?,?,?)',[device.tenant_id,id,eventId,JSON.stringify(payload),JSON.stringify(result),now]);
   await tx.execute('UPDATE devices SET last_communication=?,battery=?,battery_reported_at=? WHERE id=?',[now,payload.battery,now,id]);
   await this.alert(tx,device,'Disconnected',false,{});if(payload.battery!==15)await this.alert(tx,device,'LowBattery',payload.battery<15,{battery:payload.battery,reportedAt:now.toISOString()});
   await tx.commit();return result;
  }catch(error){await tx.rollback();throw error;}finally{tx.release();}
 }
 async evaluate(tenantId){
  const[devices]=await this.pool.execute('SELECT id,tenant_id FROM devices WHERE active=true AND (? IS NULL OR tenant_id=?)',[tenantId??null,tenantId??null]);
  for(const ref of devices){const tx=await this.pool.getConnection();try{await tx.beginTransaction();const device=await this.device(ref.tenant_id,ref.id,tx,true);if(device.active){const last=device.last_communication??device.created_at;await this.alert(tx,device,'Disconnected',+this.clock()-+new Date(last)>=300000,{lastCommunication:device.last_communication});}await tx.commit();}catch(error){await tx.rollback();throw error;}finally{tx.release();}}
 }
 async read(tenantId,id){const d=await this.device(tenantId,id),now=this.clock(),last=d.last_communication?new Date(d.last_communication):null;
  const fresh=last&&+now-+last<300000;
  const[calibrations]=await this.pool.execute('SELECT id,calibrated_at AS calibratedAt,expires_at AS expiresAt,evidence_ref AS evidenceRef FROM device_calibrations WHERE tenant_id=? AND device_id=? ORDER BY calibrated_at DESC',[tenantId,id]);
  const[alerts]=await this.pool.execute('SELECT id,kind,details,opened_at AS openedAt,resolved_at AS resolvedAt FROM device_alerts WHERE tenant_id=? AND device_id=? ORDER BY opened_at',[tenantId,id]);
  const[readings]=await this.pool.execute('SELECT result FROM device_readings WHERE tenant_id=? AND device_id=? ORDER BY received_at DESC,event_id LIMIT 100',[tenantId,id]);
  const[audit]=await this.pool.execute('SELECT action,payload,actor_id AS actorId,occurred_at AS occurredAt FROM device_audit WHERE tenant_id=? AND device_id=? ORDER BY occurred_at',[tenantId,id]);
  return {deviceId:id,serial:d.serial,name:d.name,lotId:d.operation_lot_id,version:d.version,active:Boolean(d.active),connection:!d.active?'Disabled':!last?'Unconfirmed':fresh?'Online':'Disconnected',lastCommunication:last,battery:d.battery,batteryReportedAt:d.battery_reported_at,batteryCurrent:Boolean(fresh),calibrations,alerts,readings:readings.map(r=>r.result),audit,checkedAt:now.toISOString()};
 }
 async list(tenantId){const[rows]=await this.pool.execute('SELECT id FROM devices WHERE tenant_id=? ORDER BY created_at DESC,id',[tenantId]);return Promise.all(rows.map(r=>this.read(tenantId,r.id)));}
}
