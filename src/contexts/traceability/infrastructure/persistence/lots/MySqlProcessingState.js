import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { MySqlUnitOfWork } from './MySqlLotStore.js';
import { MySqlOperationalState } from './MySqlOperationalState.js';
import { OperationError } from '../../../../../shared/application/OperationError.js';
import { mass, formatMass, percentage } from '../../../../../shared/domain/decimalMass.js';
import { validatePurity, validateTransformation } from '../../../../../shared/domain/processingRules.js';
import { uuid, text } from '../../../../../shared/infrastructure/http/operationHttp.js';

export class MySqlProcessingState {
  constructor(pool) { this.pool=pool;this.unitOfWork=new MySqlUnitOfWork(pool);this.operational=new MySqlOperationalState(pool); }
  async view(tenantId,lotId,db=this.pool) {
    const state=await this.operational.snapshot(tenantId,lotId,db);
    const [rows]=await db.execute('SELECT payload FROM lot_processing_facts WHERE tenant_id=? AND lot_id=?',[tenantId,lotId]);
    const facts=rows.map(row=>row.payload).sort((a,b)=>a.version-b.version);
    return {...state,facts,latestAssay:[...facts].reverse().find(fact=>fact.action==='AssayRecorded')??null};
  }
  async genealogy(tenantId,lotId,db=this.pool) {
    const nodes=new Map(),edges=[],visiting=new Set(),complete=new Set();
    const visit=async id=>{
      if(visiting.has(id))throw new OperationError(409,'CYCLIC_GENEALOGY','La genealogía contiene un ciclo y requiere revisión');
      if(complete.has(id))return;
      if(nodes.size>=300)throw new OperationError(409,'GENEALOGY_LIMIT','La genealogía requiere revisión por superar el límite de consulta');
      visiting.add(id);
      const state=await this.view(tenantId,id,db);nodes.set(id,state);
      const [parents]=await db.execute('SELECT parent_lot_id AS parentId FROM lot_lineage WHERE tenant_id=? AND child_lot_id=?',[tenantId,id]);
      for(const {parentId} of parents){edges.push({parentId,childId:id});await visit(parentId);}
      visiting.delete(id);complete.add(id);
    };
    await visit(lotId);
    return {lotId,nodes:[...nodes.values()],edges,roots:[...nodes.keys()].filter(id=>!edges.some(edge=>edge.childId===id))};
  }
  async execute(command) {
    return this.unitOfWork.run(async tx=>{
      const {tenantId,actorId,lotId,operationId,action}=command;
      const inputRefs=action==='LotsTransformed'?command.inputs:[{lotId,expectedVersion:command.expectedVersion}];
      if(!Array.isArray(inputRefs)||inputRefs.length<1||inputRefs.length>20||new Set(inputRefs.map(input=>input.lotId)).size!==inputRefs.length||!inputRefs.some(input=>input.lotId===lotId))throw new OperationError(400,'INVALID_INPUTS','Selecciona entradas diferentes e identificadas');
      if(inputRefs.some(input=>!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1)||inputRefs.find(input=>input.lotId===lotId).expectedVersion!==command.expectedVersion)throw new OperationError(400,'INVALID_VERSION','Las versiones de entrada deben coincidir con el lote principal consultado');
      for(const input of [...inputRefs].sort((a,b)=>a.lotId.localeCompare(b.lotId))){uuid(input.lotId);await tx.execute('SELECT id FROM mineral_lots WHERE tenant_id=? AND id=? FOR UPDATE',[tenantId,input.lotId]);}
      const [previous]=await tx.execute('SELECT command,result FROM lot_lifecycle_events WHERE tenant_id=? AND operation_id=?',[tenantId,operationId]);
      if(previous.length){if(!isDeepStrictEqual(previous[0].command,command))throw new OperationError(409,'OPERATION_ID_REUSED','Identificador reutilizado con otros datos');return previous[0].result;}
      const states=[];
      for(const input of inputRefs){const state=await this.view(tenantId,input.lotId,tx);if(state.version!==input.expectedVersion)throw new OperationError(409,'VERSION_CONFLICT','Una entrada cambió; vuelve a consultarla');states.push(state);}
      const state=states.find(state=>state.lotId===lotId);
      const result={operationId,lotId,actorId,action,status:state.status,version:state.version+1,occurredAt:new Date().toISOString()};
      const requireProcessing=()=>{if(state.status!=='Processing')throw new OperationError(409,'INVALID_LOT_STATE','El lote debe estar en procesamiento');};
      const unblocked=()=>{if(states.some(input=>input.restrictions.length))throw new OperationError(409,'PROCESSING_RESTRICTED','Resuelve las restricciones antes de continuar');};
      if(action==='ProcessingStarted'){
        if(state.status!=='Received')throw new OperationError(409,'INVALID_LOT_STATE','Primero confirma la recepción en planta');unblocked();result.status='Processing';
      }else if(action==='AssayRecorded'){
        requireProcessing();result.purity=validatePurity(command.purity);result.evidenceRef=text(command.evidenceRef,'Evidencia de análisis');result.assayId=operationId;
        if(state.latestAssay){if(command.correctionOf!==state.latestAssay.assayId)throw new OperationError(409,'ASSAY_VERSION_CONFLICT','La corrección debe identificar el análisis vigente');result.correctionReason=text(command.correctionReason,'Motivo de corrección');result.correctionOf=state.latestAssay.assayId;}
        else if(command.correctionOf)throw new OperationError(409,'ASSAY_NOT_FOUND','No existe el análisis que se pretende corregir');
      }else if(action==='PurificationRecorded'||action==='TechnicalLossRecorded'){
        requireProcessing();unblocked();const before=mass(state.weight,state.weightUnit);let after,removed,kind;
        if(action==='PurificationRecorded'){
          after=mass(command.netWeight,command.weightUnit);if(after>before)throw new OperationError(409,'MASS_INCREASE','El peso purificado no puede superar la entrada sin una adición documentada');
          if(!['Impurities','TechnicalLoss'].includes(command.removedKind))throw new OperationError(400,'INVALID_LOSS_KIND','Clasifica el material separado como impurezas o merma técnica');kind=command.removedKind;
          result.evidenceRef=text(command.evidenceRef,'Evidencia de purificación');
        }else{removed=mass(command.lossWeight,command.weightUnit);if(removed>=before)throw new OperationError(409,'INVALID_LOSS','La merma no puede consumir ni superar toda la masa');after=before-removed;kind='TechnicalLoss';}
        removed=before-after;result.reason=removed>0n?text(command.reason,'Motivo de la diferencia'):command.reason?.trim()||'Sin diferencia de masa';
        result.grossWeight=state.weight;result.grossUnit=state.weightUnit;result.netWeight=formatMass(after,state.weightUnit);result.weightUnit=state.weightUnit;
        result.removedWeight=formatMass(removed,state.weightUnit);result.removedKind=kind;result.lossPercentage=percentage(removed,before);result.critical=kind==='TechnicalLoss'&&removed*100n>before*5n;
        if(result.critical){result.restrictionId=operationId;await tx.execute('INSERT INTO lot_restrictions(id,tenant_id,lot_id,reason) VALUES(?,?,?,?)',[operationId,tenantId,lotId,'Merma técnica superior al 5% pendiente de revisión']);}
        await tx.execute('UPDATE mineral_lots SET weight=? WHERE tenant_id=? AND id=?',[result.netWeight,tenantId,lotId]);
      }else if(action==='LotsTransformed'){
        if(states.some(input=>input.status!=='Processing'))throw new OperationError(409,'INVALID_LOT_STATE','Todas las entradas deben estar disponibles en procesamiento');unblocked();
        result.balance=validateTransformation(states,command.plan);
        if(new Set(states.map(input=>input.mineralType)).size!==1)throw new OperationError(409,'INCOMPATIBLE_MINERALS','Las entradas deben tener mineral compatible');
        const graphs=[];for(const input of states)graphs.push(await this.genealogy(tenantId,input.lotId,tx));
        if(graphs.some(graph=>graph.nodes.some(node=>node.restrictions.length||node.originEvidenceStatus==='Rejected')))throw new OperationError(409,'ANCESTRY_RESTRICTED','Un ancestro presenta evidencia rechazada o una restricción');
        const originSignature=graph=>JSON.stringify([...new Set(graph.roots.map(id=>{const root=graph.nodes.find(node=>node.lotId===id);return JSON.stringify([root.evidenceReference,root.originSource]);}))].sort());
        if(command.plan.mode==='Merge'&&new Set(graphs.map(originSignature)).size!==1)throw new OperationError(409,'INCOMPATIBLE_ORIGINS','La fusión requiere entradas del mismo origen documentado');
        result.plan=command.plan;result.status='Consumed';result.children=[];
        const review=states.every(input=>input.originEvidenceStatus==='Verified')?'Verified':'PendingReview';
        for(const output of command.plan.outputs){
          const id=randomUUID();const child={lotId:id,status:'Processing',version:1,mineralType:state.mineralType,weight:output.weight,weightUnit:output.weightUnit,destination:text(output.destination,'Destino',200),kind:output.kind};
          await tx.execute("INSERT INTO mineral_lots(id,tenant_id,mineral_type,weight,weight_unit,status,version,created_at) VALUES(?,?,?,?,?,'Processing',1,?)",[id,tenantId,state.mineralType,output.weight,output.weightUnit,new Date()]);
          await tx.execute('INSERT INTO origin_evidence(id,tenant_id,lot_id,reference,source,review_status) VALUES(?,?,?,?,?,?)',[randomUUID(),tenantId,id,state.evidenceReference,'Transformación documentada; consultar genealogía',review]);
          for(const input of states)await tx.execute('INSERT INTO lot_lineage(tenant_id,parent_lot_id,child_lot_id,operation_id) VALUES(?,?,?,?)',[tenantId,input.lotId,id,operationId]);
          const creation={...result,...child,action:'TransformationOutputCreated',parents:states.map(input=>input.lotId)};delete creation.children;
          await tx.execute('INSERT INTO lot_processing_facts(tenant_id,lot_id,operation_id,action,payload) VALUES(?,?,?,?,?)',[tenantId,id,operationId,creation.action,JSON.stringify(creation)]);
          if(result.balance.criticalLoss)await tx.execute('INSERT INTO lot_restrictions(id,tenant_id,lot_id,reason) VALUES(?,?,?,?)',[randomUUID(),tenantId,id,'Merma técnica superior al 5% en la transformación de origen']);
          result.children.push(child);
        }
        result.consumed=states.map(input=>({lotId:input.lotId,status:'Consumed',version:input.version+1}));
        for(const input of states)await tx.execute("UPDATE mineral_lots SET status='Consumed',version=version+1 WHERE tenant_id=? AND id=?",[tenantId,input.lotId]);
      }else if(action==='ProcessingCompleted'){
        requireProcessing();unblocked();if(!state.latestAssay)throw new OperationError(409,'ASSAY_REQUIRED','Falta registrar el análisis requerido');
        if(!state.facts.some(fact=>['PurificationRecorded','TechnicalLossRecorded','TransformationOutputCreated'].includes(fact.action)))throw new OperationError(409,'PROCESSING_STAGE_REQUIRED','Falta documentar la etapa y el balance de procesamiento');
        result.status='Processed';result.reviewNote=text(command.reviewNote,'Revisión de etapas');result.assayId=state.latestAssay.assayId;
      }else throw new OperationError(400,'INVALID_ACTION','Operación de planta no reconocida');
      if(action!=='LotsTransformed')await tx.execute('UPDATE mineral_lots SET status=?,version=? WHERE tenant_id=? AND id=?',[result.status,result.version,tenantId,lotId]);
      await tx.execute('INSERT INTO lot_lifecycle_events(operation_id,tenant_id,lot_id,actor_id,action,command,result) VALUES(?,?,?,?,?,?,?)',[operationId,tenantId,lotId,actorId,action,JSON.stringify(command),JSON.stringify(result)]);
      for(const input of states){const fact={...result,lotId:input.lotId,version:input.version+1};await tx.execute('INSERT INTO lot_processing_facts(tenant_id,lot_id,operation_id,action,payload) VALUES(?,?,?,?,?)',[tenantId,input.lotId,operationId,action,JSON.stringify(fact)]);}
      return result;
    });
  }
}
