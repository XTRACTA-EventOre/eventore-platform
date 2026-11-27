import {Router} from 'express';
import {randomUUID, timingSafeEqual, createHash} from 'node:crypto';
import {transaction} from '../../shared/infrastructure/persistence/transaction.js';
import {requirePermission} from '../../shared/infrastructure/http/permissions.js';
import {OperationError} from '../../shared/application/OperationError.js';
import {uuid,apiError,text} from '../../shared/infrastructure/http/operationHttp.js';

const premiumPrice=4900;
const conflict=message=>new OperationError(409,'BILLING_CONFLICT',message);
async function current(db,tenant) {
  await db.execute("INSERT INTO subscriptions(tenant_id,cycle_end) VALUES(?,UTC_TIMESTAMP()+INTERVAL 1 MONTH) ON DUPLICATE KEY UPDATE tenant_id=tenant_id",[tenant]);
  await db.execute("UPDATE subscriptions SET plan=COALESCE(next_plan,plan), next_plan=NULL, cycle_end=TIMESTAMPADD(MONTH,TIMESTAMPDIFF(MONTH,cycle_end,UTC_TIMESTAMP())+1,cycle_end) WHERE tenant_id=? AND cycle_end<=UTC_TIMESTAMP()",[tenant]);
  const [[subscription]]=await db.execute('SELECT plan,next_plan,cycle_end FROM subscriptions WHERE tenant_id=? FOR UPDATE',[tenant]);
  return subscription;
}
const authorized=(a,b)=>a&&b&&timingSafeEqual(...[a,b].map(x=>createHash('sha256').update(x).digest()));
export function billingRouter(pool,auth,providerSecret) {
  const router=Router(), admin=[auth,requirePermission('users.manage')];
  const run=fn=>async(req,res)=>{
    res.set('Cache-Control','no-store');
    try{const result=await fn(req,res);if(!res.headersSent)res.json(result);}catch(error){apiError(res,error);}
  };
  router.get('/',...admin,run(req=>transaction(pool,async db=>{
    const tenant=req.identity.tenantId, subscription=await current(db,tenant);
    const [history]=await db.execute('SELECT id,target,amount_minor,currency,status,period_start,period_end,created_at FROM billing_orders WHERE tenant_id=? ORDER BY created_at DESC,id',[tenant]);
    return {subscription,history,priceMinor:premiumPrice,currency:'PEN',features:subscription.plan==='Pro'?['Historial','Comprobantes','Exportación de facturación CSV']:['Historial','Comprobantes']};
  })));
  router.post('/upgrade',...admin,run(req=>transaction(pool,async db=>{
    const tenant=req.identity.tenantId, sub=await current(db,tenant);
    if(sub.plan==='Pro')throw conflict('Ya cuentas con el plan Pro');
    const [[pending]]=await db.execute("SELECT id FROM billing_orders WHERE tenant_id=? AND status='Pending' LIMIT 1",[tenant]);
    if(pending)return pending;
    const id=randomUUID();
    await db.execute("INSERT INTO billing_orders(id,tenant_id,target,amount_minor,currency,status) VALUES(?,?,'Pro',?,'PEN','Pending')",[id,tenant,premiumPrice]);
    return {id,status:'Pending'};
  })));
  router.post('/downgrade',...admin,run(req=>transaction(pool,async db=>{
    const tenant=req.identity.tenantId,sub=await current(db,tenant);
    if(sub.plan!=='Pro') throw conflict('El plan actual es Base');
    await db.execute("UPDATE subscriptions SET next_plan='Base' WHERE tenant_id=?",[tenant]);
    return {effectiveAt:sub.cycle_end};
  })));
  router.post('/confirmation',run(async req=>{
    if(!authorized(req.get('authorization'),providerSecret?'Bearer '+providerSecret:null))throw new OperationError(403,'FORBIDDEN','Proveedor no autorizado');
    const {id,status,amountMinor,currency,reference}=req.body??{};
    uuid(id);text(reference,'Referencia de pago',160);
    if(!['Paid','Rejected'].includes(status))throw conflict('Estado de pago inválido');
    return transaction(pool,async db=>{
      const [[lookup]]=await db.execute('SELECT tenant_id FROM billing_orders WHERE id=?',[id]);
      if(!lookup)throw new OperationError(404,'NOT_FOUND','Orden no disponible');
      await current(db,lookup.tenant_id);
      const [[order]]=await db.execute('SELECT * FROM billing_orders WHERE id=? FOR UPDATE',[id]);
      if(amountMinor!==order.amount_minor||currency!==order.currency)throw conflict('Importe o moneda incorrectos');
      if(order.status!=='Pending'){
        if(order.status===status&&order.provider_ref===reference)return {id,status};
        throw conflict('La orden ya tiene una resolución');
      }
      await db.execute("UPDATE billing_orders SET status=?,provider_ref=?,period_start=IF(?='Paid',UTC_TIMESTAMP(),NULL),period_end=IF(?='Paid',UTC_TIMESTAMP()+INTERVAL 1 MONTH,NULL) WHERE id=?",[status,reference,status,status,id]);
      if(status==='Paid')await db.execute("UPDATE subscriptions SET plan='Pro',next_plan=NULL,cycle_end=(SELECT period_end FROM billing_orders WHERE id=?) WHERE tenant_id=?",[id,order.tenant_id]);
      return {id,status};
    });
  }));
  router.get('/history.csv',...admin,run(async(req,res)=>{
    const rows=await transaction(pool,async db=>{
      if((await current(db,req.identity.tenantId)).plan!=='Pro')throw new OperationError(403,'PLAN_REQUIRED','La exportación requiere el plan Pro');
      return (await db.execute('SELECT id,amount_minor,currency,status FROM billing_orders WHERE tenant_id=? ORDER BY created_at',[req.identity.tenantId]))[0];
    });
    res.attachment('facturacion.csv').type('text/csv').send(['Orden,Importe,Moneda,Estado',...rows.map(r=>[r.id,(r.amount_minor/100).toFixed(2),r.currency,r.status].join(','))].join('\r\n'));
  }));
  router.get('/documents/:id',...admin,run(async(req,res)=>{
    const [[order]]=await pool.execute('SELECT id,amount_minor,currency,status,period_start,period_end FROM billing_orders WHERE id=? AND tenant_id=?',[uuid(req.params.id),req.identity.tenantId]);
    if(!order)throw new OperationError(404,'NOT_FOUND','Documento no disponible');
    if(order.status!=='Paid')throw conflict('El comprobante estará disponible al confirmar el pago');
    res.attachment('pago-'+order.id+'.json').json(order);
  }));
  return router;
}
