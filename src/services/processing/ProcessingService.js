import { DurableOperation } from '../../shared/infrastructure/persistence/DurableOperation.js';
import { ServiceClient } from '../../shared/infrastructure/http/ServiceClient.js';
import { OperationError } from '../../shared/application/OperationError.js';
export class ProcessingService {
  constructor({pool,traceabilityUrl,internalSecret,fetchImpl=fetch}){
    this.pool=pool;this.ledger=new DurableOperation(pool,'processing_operations');this.trace=new ServiceClient({url:traceabilityUrl,secret:internalSecret,fetchImpl});
  }
  async confirm(command,result){
    if(result.operationId!==command.operationId||result.lotId!==command.lotId||result.actorId!==command.actorId||result.action!==command.action||result.version!==command.expectedVersion+1)throw new OperationError(503,'INVALID_PROCESSING_RESPONSE','Respuesta de planta sin confirmar');
    return this.ledger.confirm(command,result,async tx=>{
      await tx.execute('INSERT INTO processing_events(tenant_id,operation_id,lot_id,actor_id,action,result) VALUES(?,?,?,?,?,?)',[command.tenantId,command.operationId,command.lotId,command.actorId,command.action,JSON.stringify(result)]);
      for(const item of [{lotId:result.lotId,status:result.status,version:result.version},...(result.consumed??[]),...(result.children??[])]){
        await tx.execute(`INSERT INTO processing_lots(tenant_id,lot_id,source_version,status,snapshot) VALUES(?,?,?,?,?)
          ON DUPLICATE KEY UPDATE snapshot=IF(source_version<VALUES(source_version),VALUES(snapshot),snapshot),status=IF(source_version<VALUES(source_version),VALUES(status),status),source_version=GREATEST(source_version,VALUES(source_version))`,[command.tenantId,item.lotId,item.version,item.status,JSON.stringify(item)]);
      }
    });
  }
  async execute(command,req){
    const record=await this.ledger.start(command);if(record.state==='Accepted')return record.result;
    try{return await this.confirm(command,await this.trace.request(`/internal/lots/${command.lotId}/processing`,{req,body:command}));}
    catch(error){
      if(error instanceof OperationError&&error.status<500){
        try{return await this.confirm(command,await this.trace.request(`/internal/lot-operations/${command.operationId}`,{req}));}
        catch(lookup){if(!(lookup instanceof OperationError)||lookup.status!==404)throw lookup;}
        await this.ledger.reject(command,error);
      }throw error;
    }
  }
  async read(tenantId,lotId,req){
    const [pending]=await this.pool.execute("SELECT command FROM processing_operations WHERE tenant_id=? AND state='Pending' LIMIT 100",[tenantId]);
    for(const {command}of pending){if(command.lotId!==lotId&&!command.inputs?.some(input=>input.lotId===lotId))continue;
      try{await this.confirm(command,await this.trace.request(`/internal/lot-operations/${command.operationId}`,{req}));}
      catch(error){if(!(error instanceof OperationError)||![404,503].includes(error.status))throw error;}}
    const snapshot=await this.trace.request(`/internal/lots/${lotId}/processing`,{req});
    const [events]=await this.pool.execute('SELECT result FROM processing_events WHERE tenant_id=? AND lot_id=? ORDER BY occurred_at,operation_id',[tenantId,lotId]);
    return {snapshot,events:events.map(row=>row.result)};
  }
}
