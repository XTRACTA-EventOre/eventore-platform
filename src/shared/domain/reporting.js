import {OperationError} from '../application/OperationError.js';
import {mass,formatMass,percentage} from './decimalMass.js';
export function dateRange(from,to){const start=new Date(from),end=new Date(to);if(typeof from!=='string'||typeof to!=='string'||!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start||+end-+start>20*366*86400000)throw new OperationError(400,'INVALID_DATE_RANGE','Indica un periodo válido de hasta veinte años, con final posterior al inicio');return {from:start.toISOString(),to:end.toISOString(),deferred:+end-+start>365*86400000};}
export function lossReport(events){let input=0n,loss=0n;const operations=[];
 for(const event of events){const result=event.result??event;let before=0n,removed=0n;
  if(['TechnicalLossRecorded','PurificationRecorded'].includes(result.action)&&result.removedKind==='TechnicalLoss'){before=mass(result.grossWeight,result.grossUnit);removed=mass(result.removedWeight,result.weightUnit,{zero:true});}
  else if(result.action==='LotsTransformed'&&result.plan?.technicalLoss){before=BigInt(result.balance.inputMassScaledGrams);removed=mass(result.plan.technicalLoss.weight,result.plan.technicalLoss.weightUnit,{zero:true});}
  else continue;
  if(before<=0n||removed===0n)continue;input+=before;loss+=removed;
  operations.push({operationId:result.operationId,lotId:result.lotId,occurredAt:result.occurredAt,inputGrams:formatMass(before,'g',{maxIntegerDigits:45}),lossGrams:formatMass(removed,'g',{maxIntegerDigits:45}),lossPercentage:percentage(removed,before),reason:result.reason??result.plan?.reason??'Sin motivo registrado',critical:removed*100n>before*5n,interpretation:'Diferencia por investigar; no demuestra robo'});
 }
 return {operations,inputGrams:formatMass(input,'g',{maxIntegerDigits:45}),lossGrams:formatMass(loss,'g',{maxIntegerDigits:45}),weightedLossPercentage:input?percentage(loss,input):'0',interpretation:'Masa total de merma técnica sobre masa total de entrada de las operaciones; excluye impurezas'};
}
export function csvCell(value){let text=String(value??'');if(/^[\s]*[=+@\-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export function evidenceCsv(source){const headers=['lotId','mineralType','weight','weightUnit','status','source','evidenceReference','reviewStatus','createdAt','scope'];const scope='Evidencia para revisión; no acredita por sí sola cumplimiento normativo ESG';return '\uFEFF'+[headers,...source.lots.map(lot=>[lot.lotId,lot.mineralType,lot.weight,lot.weightUnit,lot.status,lot.originSource,lot.evidenceReference,lot.originEvidenceStatus,lot.createdAt,scope])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';}
