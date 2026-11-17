import {LocalCommands} from '../../shared/infrastructure/persistence/LocalCommands.js';
import {OperationError} from '../../shared/application/OperationError.js';
import {point,polygon,contains} from '../../shared/domain/geofence.js';
import {text,uuid} from '../../shared/infrastructure/http/operationHttp.js';
export class GeofenceService{
 constructor(pool){this.pool=pool;this.commands=new LocalCommands(pool,'geofence_operations');}
 async list(tenantId){const[rows]=await this.pool.execute('SELECT id,name,polygon,source,authorization_ref AS authorizationRef,approved_at AS approvedAt FROM authorized_concessions WHERE tenant_id=? ORDER BY approved_at DESC,id',[tenantId]);return rows;}
 async register(command){const vertices=polygon(command.polygon);return this.commands.run(command,async tx=>{
  if(command.confirmAuthorization!==true)throw new OperationError(400,'AUTHORIZATION_REQUIRED','Confirma que se revisó la fuente de autorización de la concesión');
  await tx.execute('INSERT INTO authorized_concessions(tenant_id,id,name,polygon,source,authorization_ref,approved_by) VALUES(?,?,?,?,?,?,?)',[command.tenantId,command.operationId,text(command.name,'Nombre',200),JSON.stringify(vertices),text(command.source,'Fuente verificable'),text(command.authorizationRef,'Documento de autorización'),command.actorId]);
  return {concessionId:command.operationId,status:'Authorized',vertexCount:vertices.length};
 });}
 async read(tenantId,lotId){const[[lot]]=await this.pool.execute('SELECT id FROM mineral_lots WHERE tenant_id=? AND id=?',[tenantId,lotId]);if(!lot)throw new OperationError(404,'LOT_NOT_FOUND','Lote no encontrado');
  const[checks]=await this.pool.execute('SELECT result FROM lot_location_checks WHERE tenant_id=? AND lot_id=?',[tenantId,lotId]);
  const[[capture]]=await this.pool.execute('SELECT declaration FROM lot_capture_locations WHERE tenant_id=? AND lot_id=?',[tenantId,lotId]);
  const history=checks.map(r=>r.result).sort((a,b)=>a.version-b.version);return {lotId,status:history.at(-1)?.status??'PendingCheck',capture:capture?.declaration??null,history};
 }
 async check(command){return this.commands.run(command,async tx=>{
  const[[lot]]=await tx.execute('SELECT version,status FROM mineral_lots WHERE tenant_id=? AND id=? FOR UPDATE',[command.tenantId,command.lotId]);if(!lot)throw new OperationError(404,'LOT_NOT_FOUND','Lote no encontrado');
  if(lot.version!==command.expectedVersion)throw new OperationError(409,'VERSION_CONFLICT','El lote cambió; vuelve a consultarlo');
  let concession=null,location=null;
  if(command.concessionId){uuid(command.concessionId);[[concession]]=await tx.execute('SELECT * FROM authorized_concessions WHERE tenant_id=? AND id=?',[command.tenantId,command.concessionId]);if(!concession)throw new OperationError(404,'CONCESSION_NOT_FOUND','Concesión autorizada no encontrada');}
  if(command.location)location=point(command.location);
  const status=location&&concession?(contains(concession.polygon,location)?'Inside':'Outside'):'PendingCheck';
  const result={operationId:command.operationId,lotId:command.lotId,actorId:command.actorId,status,location,concessionId:concession?.id??null,source:concession?.source??null,authorizationRef:concession?.authorization_ref??null,reason:text(command.reason,'Motivo de comprobación'),version:lot.version+1,occurredAt:new Date().toISOString(),originApproved:false};
  // Location checks never automatically approve evidence; an outside/pending claim removes prior approval.
  if(status!=='Inside')await tx.execute("UPDATE origin_evidence SET review_status='PendingReview' WHERE tenant_id=? AND lot_id=?",[command.tenantId,command.lotId]);
  await tx.execute('UPDATE mineral_lots SET version=version+1 WHERE tenant_id=? AND id=?',[command.tenantId,command.lotId]);
  await tx.execute('INSERT INTO lot_location_checks(tenant_id,lot_id,operation_id,result) VALUES(?,?,?,?)',[command.tenantId,command.lotId,command.operationId,JSON.stringify(result)]);return result;
 });}
}
