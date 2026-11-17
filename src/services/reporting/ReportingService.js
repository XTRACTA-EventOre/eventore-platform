import {randomUUID} from 'node:crypto';
import {ServiceClient} from '../../shared/infrastructure/http/ServiceClient.js';
import {LocalCommands} from '../../shared/infrastructure/persistence/LocalCommands.js';
import {OperationError} from '../../shared/application/OperationError.js';
import {dateRange,lossReport,evidenceCsv} from '../../shared/domain/reporting.js';
export class ReportingService{
 constructor({pool,traceabilityUrl,internalSecret,fetchImpl=fetch}){this.pool=pool;this.trace=new ServiceClient({url:traceabilityUrl,secret:internalSecret,fetchImpl});this.commands=new LocalCommands(pool,'reporting_operations');this.active=new Map();}
 source(tenantId,range){return this.trace.request('/internal/reporting/source'+(range?'?'+new URLSearchParams({from:range.from,to:range.to}):''),{tenantId});}
 async record(tenantId,kind,parameters,result){const id=randomUUID();await this.pool.execute('INSERT INTO reporting_snapshots(id,tenant_id,kind,parameters,result) VALUES(?,?,?,?,?)',[id,tenantId,kind,JSON.stringify(parameters),JSON.stringify(result)]);return {...result,snapshotId:id};}
 async dashboard(tenantId){const source=await this.source(tenantId),states=Object.fromEntries(['Registered','Cancelled','InTransit','Received','Processing','Processed','Consumed','AtJewelry'].map(status=>[status,0]));for(const lot of source.lots)states[lot.status]=(states[lot.status]??0)+1;
  return this.record(tenantId,'Dashboard',{}, {states,total:source.lots.length,active:source.lots.filter(lot=>!['Cancelled','Consumed'].includes(lot.status)).length,lots:source.lots.map(({originSource,evidenceReference,...lot})=>lot),updatedAt:source.capturedAt,scope:source.source});
 }
 async losses(tenantId,from,to){const range=dateRange(from,to),source=await this.source(tenantId,range);return this.record(tenantId,'TechnicalLoss',range,{...lossReport(source.events),range,updatedAt:source.capturedAt});}
 async requestExport(command){const range=dateRange(command.from,command.to);return this.commands.run(command,async tx=>{
  await tx.execute("INSERT INTO evidence_exports(tenant_id,id,actor_id,parameters,state) VALUES(?,?,?,?,'Pending')",[command.tenantId,command.operationId,command.actorId,JSON.stringify(range)]);
  return {exportId:command.operationId,state:'Pending',deferred:range.deferred,downloadUrl:`/api/v1/reporting/exports/${command.operationId}/download`};
 });}
 async export(tenantId,id){const[[row]]=await this.pool.execute('SELECT * FROM evidence_exports WHERE tenant_id=? AND id=?',[tenantId,id]);if(!row)throw new OperationError(404,'EXPORT_NOT_FOUND','Exportación no encontrada');return row;}
 process(tenantId,id){const key=tenantId+':'+id;if(this.active.has(key))return this.active.get(key);
  const job=(async()=>{try{const row=await this.export(tenantId,id);if(row.state==='Ready')return;
   const source=await this.source(tenantId,row.parameters),content=Buffer.from(evidenceCsv(source),'utf8');
   await this.pool.execute("UPDATE evidence_exports SET state='Ready',content=?,source_captured_at=?,completed_at=UTC_TIMESTAMP(3) WHERE tenant_id=? AND id=? AND state='Pending'",[content,new Date(source.capturedAt),tenantId,id]);
  }catch{ /* Pending is durable and retried by the worker or an authorized status request. */ }finally{this.active.delete(key);}})();this.active.set(key,job);return job;
 }
 async resume(){const[rows]=await this.pool.execute("SELECT tenant_id,id FROM evidence_exports WHERE state='Pending' ORDER BY created_at LIMIT 20");for(const row of rows)await this.process(row.tenant_id,row.id);}
 async status(tenantId,id){let row=await this.export(tenantId,id);if(row.state==='Pending')void this.process(tenantId,id);return {exportId:id,state:row.state,from:row.parameters.from,to:row.parameters.to,createdAt:row.created_at,completedAt:row.completed_at,sourceCapturedAt:row.source_captured_at,downloadUrl:`/api/v1/reporting/exports/${id}/download`,scope:'Evidencia para revisión; no acredita por sí sola cumplimiento normativo ESG'};}
}
