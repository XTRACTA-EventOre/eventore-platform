import {isDeepStrictEqual} from 'node:util';
import {OperationError} from '../../application/OperationError.js';
export class LocalCommands{
 constructor(pool,table){if(!['device_operations','geofence_operations','reporting_operations'].includes(table))throw Error('Invalid local command table');Object.assign(this,{pool,table});}
 async run(command,apply){const tx=await this.pool.getConnection();try{await tx.beginTransaction();
  await tx.execute(`INSERT IGNORE INTO ${this.table}(tenant_id,operation_id,command) VALUES(?,?,?)`,[command.tenantId,command.operationId,JSON.stringify(command)]);
  const[[old]]=await tx.execute(`SELECT command,result FROM ${this.table} WHERE tenant_id=? AND operation_id=? FOR UPDATE`,[command.tenantId,command.operationId]);
  if(!isDeepStrictEqual(old.command,command))throw new OperationError(409,'OPERATION_ID_REUSED','El identificador ya corresponde a otros datos');
  if(old.result){await tx.commit();return old.result;}
  const result=await apply(tx);await tx.execute(`UPDATE ${this.table} SET result=? WHERE tenant_id=? AND operation_id=?`,[JSON.stringify(result),command.tenantId,command.operationId]);await tx.commit();return result;
 }catch(error){await tx.rollback();throw error;}finally{tx.release();}}
}
