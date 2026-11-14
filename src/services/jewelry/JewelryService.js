import { randomUUID } from 'node:crypto';
import { DurableOperation } from '../../shared/infrastructure/persistence/DurableOperation.js';
import { ServiceClient } from '../../shared/infrastructure/http/ServiceClient.js';
import { OperationError } from '../../shared/application/OperationError.js';
import { mass,formatMass } from '../../shared/domain/decimalMass.js';
import { uuid,text } from '../../shared/infrastructure/http/operationHttp.js';
const fail=(code,message,status=409)=>{throw new OperationError(status,code,message);};
export class JewelryService {
  constructor({pool,traceabilityUrl,internalSecret,fetchImpl=fetch}){this.pool=pool;this.ledger=new DurableOperation(pool,'jewelry_operations');this.trace=new ServiceClient({url:traceabilityUrl,secret:internalSecret,fetchImpl});}
  async inventory(tenantId){const[rows]=await this.pool.execute('SELECT id,lot_id AS lotId,mineral_type AS mineralType,category,source,quantity_grams AS quantityGrams,available_grams AS availableGrams,version FROM inventory_materials WHERE tenant_id=? ORDER BY created_at DESC,id',[tenantId]);return rows;}
  async product(tenantId,id,db=this.pool){const[[row]]=await db.execute('SELECT id,name,version,composition,updated_at AS updatedAt FROM jewelry_products WHERE tenant_id=? AND id=?',[tenantId,id]);if(!row)fail('PRODUCT_NOT_FOUND','Joya no encontrada',404);const[history]=await db.execute('SELECT version,actor_id AS actorId,reason,before_composition AS beforeComposition,after_composition AS afterComposition,occurred_at AS occurredAt FROM composition_history WHERE tenant_id=? AND product_id=? ORDER BY version',[tenantId,id]);return {...row,history};}
  async products(tenantId){const[rows]=await this.pool.execute('SELECT id,name,version,updated_at AS updatedAt FROM jewelry_products WHERE tenant_id=? ORDER BY updated_at DESC,id',[tenantId]);return rows;}
  async receipt(command,req){
    const old=await this.ledger.start(command);if(old.state==='Accepted')return old.result;
    try{
      const result=await this.trace.request(`/internal/lots/${command.lotId}/jewelry-receipt`,{req,body:command});
      return await this.confirmReceipt(command,result);
    }catch(error){
      if(error instanceof OperationError&&error.status<500){
        try{return await this.confirmReceipt(command,await this.trace.request(`/internal/lot-operations/${command.operationId}`,{req}));}
        catch(lookup){if(!(lookup instanceof OperationError)||lookup.status!==404)throw lookup;}
        await this.ledger.reject(command,error);
      }throw error;
    }
  }
  async confirmReceipt(command,result){
    if(result.operationId!==command.operationId||result.actorId!==command.actorId||result.action!=='JewelryReceived'||result.lotId!==command.lotId||result.version!==command.expectedVersion+1)fail('INVALID_RECEIPT_RESPONSE','Recepción sin confirmar',503);
    const materialId=command.operationId;
    return this.ledger.confirm(command,{...result,materialId},async tx=>{
      const quantity=formatMass(mass(result.weight,result.weightUnit),'g');
      await tx.execute('INSERT INTO inventory_materials(tenant_id,id,lot_id,mineral_type,category,source,quantity_grams,available_grams,source_version,version) VALUES(?,?,?,?,?,?,?,?,?,1)',[command.tenantId,materialId,result.lotId,result.mineralType,result.originEvidenceStatus==='Verified'?'Documented':'Declared','Lote recibido; revisar genealogía vigente',quantity,quantity,result.version]);
    });
  }
  async external(command){
    const old=await this.ledger.start(command);if(old.state==='Accepted')return old.result;
    const quantity=formatMass(mass(command.weight,command.weightUnit),'g');
    return this.ledger.confirm(command,{materialId:command.operationId,category:'External',quantityGrams:quantity,version:1},async tx=>{
      await tx.execute('INSERT INTO inventory_materials(tenant_id,id,mineral_type,category,source,quantity_grams,available_grams,version) VALUES(?,?,?,?,?,?,?,1)',[command.tenantId,command.operationId,command.mineralType,'External',command.source,quantity,quantity]);
    });
  }
  async allocate(command){
    const old=await this.ledger.start(command);if(old.state==='Accepted')return old.result;
    if(!Array.isArray(command.allocations)||command.allocations.length<1||command.allocations.length>20||new Set(command.allocations.map(a=>a.materialId)).size!==command.allocations.length)fail('INVALID_COMPOSITION','Selecciona de uno a veinte materiales diferentes',400);
    const requested=command.allocations.map(a=>({materialId:uuid(a.materialId),quantityGrams:formatMass(mass(a.weight,a.weightUnit),'g')}));
    const productId=command.productId??command.operationId;
    return this.ledger.confirm(command,{productId,version:command.expectedVersion+1,reviewRequired:true},async tx=>{
      // Lock product before stock. A new product is created with the operation UUID, making retries stable.
      const[[product]]=await tx.execute('SELECT version,composition FROM jewelry_products WHERE tenant_id=? AND id=? FOR UPDATE',[command.tenantId,productId]);
      if(command.productId&&!product)fail('PRODUCT_NOT_FOUND','Joya no encontrada',404);
      if((product?.version??0)!==command.expectedVersion)fail('VERSION_CONFLICT','La composición cambió; vuelve a consultarla');
      const previous=product?.composition??[],ids=[...new Set([...requested,...previous].map(a=>a.materialId))].sort(),materials=new Map();
      for(const id of ids){const[[row]]=await tx.execute('SELECT * FROM inventory_materials WHERE tenant_id=? AND id=? FOR UPDATE',[command.tenantId,id]);if(!row)fail('MATERIAL_NOT_FOUND','Material no encontrado',404);materials.set(id,row);}
      const categories=new Set(requested.map(a=>materials.get(a.materialId).category));
      if(categories.has('External')&&[...categories].some(c=>c!=='External'))fail('PROHIBITED_MIXTURE','El material externo debe mantenerse separado del circuito documentado o declarado');
      if(new Set(requested.map(a=>materials.get(a.materialId).mineral_type)).size!==1)fail('INCOMPATIBLE_MINERALS','La composición requiere mineral compatible');
      for(const id of ids){const material=materials.get(id),before=mass(material.available_grams,'g',{zero:true});
        const returned=previous.find(a=>a.materialId===id),taken=requested.find(a=>a.materialId===id);
        const available=before+(returned?mass(returned.quantityGrams,'g'):0n)-(taken?mass(taken.quantityGrams,'g'):0n);
        if(available<0n)fail('INSUFFICIENT_STOCK','La cantidad supera el inventario disponible');
        await tx.execute('UPDATE inventory_materials SET available_grams=?,version=version+1 WHERE tenant_id=? AND id=?',[formatMass(available,'g'),command.tenantId,id]);
      }
      const composition=requested.map(a=>({...a,lotId:materials.get(a.materialId).lot_id,category:materials.get(a.materialId).category,mineralType:materials.get(a.materialId).mineral_type}));
      if(product)await tx.execute('UPDATE jewelry_products SET name=?,version=version+1,composition=?,updated_at=UTC_TIMESTAMP(3) WHERE tenant_id=? AND id=?',[command.name,JSON.stringify(composition),command.tenantId,productId]);
      else await tx.execute('INSERT INTO jewelry_products(tenant_id,id,name,version,composition) VALUES(?,?,?,1,?)',[command.tenantId,productId,command.name,JSON.stringify(composition)]);
      await tx.execute('INSERT INTO composition_history(tenant_id,product_id,version,operation_id,actor_id,reason,before_composition,after_composition) VALUES(?,?,?,?,?,?,?,?)',[command.tenantId,productId,command.expectedVersion+1,command.operationId,command.actorId,command.reason,JSON.stringify(previous),JSON.stringify(composition)]);
    });
  }
}
