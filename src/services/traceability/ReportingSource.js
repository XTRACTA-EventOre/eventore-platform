import {OperationError} from '../../shared/application/OperationError.js';
import {dateRange} from '../../shared/domain/reporting.js';
import {decimal,formatDecimal} from '../../shared/domain/decimalMass.js';
export async function reportingSource(pool,tenantId,query){
 const range=query.from&&query.to?dateRange(query.from,query.to):null,tx=await pool.getConnection();
 try{await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await tx.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
  const[rows]=await tx.execute(`SELECT l.id AS lotId,l.mineral_type AS mineralType,l.weight,l.weight_unit AS weightUnit,l.status,l.version,l.created_at AS createdAt,e.source AS originSource,e.reference AS evidenceReference,e.review_status AS originEvidenceStatus FROM mineral_lots l JOIN origin_evidence e ON e.tenant_id=l.tenant_id AND e.lot_id=l.id WHERE l.tenant_id=? AND (? IS NULL OR l.created_at>=?) AND (? IS NULL OR l.created_at<?) ORDER BY l.created_at,l.id LIMIT 10001`,[tenantId,range?new Date(range.from):null,range?new Date(range.from):null,range?new Date(range.to):null,range?new Date(range.to):null]);
  const[events]=await tx.execute('SELECT result FROM lot_lifecycle_events WHERE tenant_id=? AND (? IS NULL OR occurred_at>=?) AND (? IS NULL OR occurred_at<?) ORDER BY occurred_at,operation_id LIMIT 20001',[tenantId,range?new Date(range.from):null,range?new Date(range.from):null,range?new Date(range.to):null,range?new Date(range.to):null]);
  if(rows.length>10000||events.length>20000)throw new OperationError(409,'REPORT_LIMIT','Divide el periodo para mantener una exportación completa dentro del límite de consulta');
  const lots=rows.map(row=>({...row,weight:formatDecimal(decimal(row.weight)),createdAt:new Date(row.createdAt).toISOString()}));
  await tx.commit();return {lots,events:events.map(row=>row.result),capturedAt:new Date().toISOString(),range:range?{from:range.from,to:range.to}:null,source:'Traceability: solo registros aceptados por el servidor'};
 }catch(error){await tx.rollback();throw error;}finally{tx.release();}
}
