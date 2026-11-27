import { Router } from 'express';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { uuid, apiError } from '../../shared/infrastructure/http/operationHttp.js';
import { OperationError } from '../../shared/application/OperationError.js';
import { transaction } from '../../shared/infrastructure/persistence/transaction.js';

const hash = token => createHash('sha256').update(token).digest('hex');
const handle = fn => async (req,res) => {
  res.set('Cache-Control','no-store');
  try { res.json(await fn(req,res)); } catch(error) { apiError(res,error); }
};

export function erpRouter({pool,traceabilityUrl,internalSecret,fetchImpl=fetch}, auth, access) {
  const router = Router();
  async function issue(db,tenant) {
    const id=randomUUID(), token=randomBytes(32).toString('hex');
    await db.execute("INSERT INTO erp_keys(id,tenant_id,token_hash,scope) VALUES(?,?,?,'inventory.lot.read')",[id,tenant,hash(token)]);
    return {id,token,scope:'inventory.lot.read'};
  }
  router.get('/keys',auth,access,handle(async req=>{
    const [keys]=await pool.execute('SELECT id,scope,revoked,created_at FROM erp_keys WHERE tenant_id=? ORDER BY created_at DESC',[req.identity.tenantId]);
    return {keys};
  }));
  router.post('/keys',auth,access,handle(req=>issue(pool,req.identity.tenantId)));
  router.post('/keys/:id/rotate',auth,access,handle(req=>transaction(pool,async db=>{
    const tenant=req.identity.tenantId;
    const [result]=await db.execute('UPDATE erp_keys SET revoked=true WHERE id=? AND tenant_id=? AND revoked=false',[uuid(req.params.id),tenant]);
    if(!result.affectedRows) throw new OperationError(409,'KEY_INACTIVE','La clave ya no está activa o no está disponible');
    return issue(db,tenant);
  })));
  router.get('/lots/:id',handle(async (req,res)=>{
    const token=req.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if(!token) throw new OperationError(401,'INVALID_KEY','Credencial ERP inválida');
    const tenant=await transaction(pool,async db=>{
      const [[key]]=await db.execute("SELECT *,FLOOR(UNIX_TIMESTAMP()/60) AS quota_minute,60-MOD(UNIX_TIMESTAMP(),60) AS retry_seconds FROM erp_keys WHERE token_hash=? AND revoked=false AND scope='inventory.lot.read' FOR UPDATE",[hash(token)]);
      if(!key) throw new OperationError(401,'INVALID_KEY','Credencial ERP inválida');
      const count=Number(key.window_minute)===Number(key.quota_minute)?key.used:0;
      if(count>=100) {
        res.set('Retry-After',String(key.retry_seconds));
        throw new OperationError(429,'RATE_LIMIT','Cuota agotada para este minuto');
      }
      await db.execute('UPDATE erp_keys SET window_minute=?,used=? WHERE id=?',[key.quota_minute,count+1,key.id]);
      return key.tenant_id;
    });
    const id=uuid(req.params.id);
    const [[material]]=await pool.execute('SELECT mineral_type,quantity_grams FROM inventory_materials WHERE tenant_id=? AND lot_id=?',[tenant,id]);
    if(!material) throw new OperationError(404,'LOT_UNAVAILABLE','Lote no disponible');
    const response=await fetchImpl(new URL('/internal/certification/lots/'+id,traceabilityUrl),{headers:{'x-internal-secret':internalSecret,'x-service-tenant':tenant},signal:AbortSignal.timeout(5000)});
    if(!response.ok) throw new Error('Traceability unavailable');
    const graph=await response.json(), node=graph.nodes.find(item=>item.lotId===id);
    if(!node) throw new Error('Missing lot');
    return {lotId:id,mineralType:material.mineral_type,quantityGrams:material.quantity_grams,status:node.status,
      history:[...node.history,...node.facts].map(({action,occurredAt})=>({action,occurredAt})),
      assay:node.latestAssay?{purity:node.latestAssay.purity,occurredAt:node.latestAssay.occurredAt}:null};
  }));
  return router;
}
