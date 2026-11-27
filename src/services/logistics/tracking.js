import {Router} from 'express';
import {ServiceClient} from '../../shared/infrastructure/http/ServiceClient.js';
import {transaction} from '../../shared/infrastructure/persistence/transaction.js';
import {uuid,apiError} from '../../shared/infrastructure/http/operationHttp.js';
import {requirePermission} from '../../shared/infrastructure/http/permissions.js';
import {OperationError} from '../../shared/application/OperationError.js';

const invalid=m=>new OperationError(400,'INVALID_ROUTE',m);
const rad=Math.PI/180;
const valid=p=>p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
function angular(a,b) {
  const lat=(b.latitude-a.latitude)*rad,lon=(b.longitude-a.longitude)*rad;
  const h=Math.sin(lat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(lon/2)**2;
  return 2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
function bearing(a,b){
  const delta=(b.longitude-a.longitude)*rad,lat=a.latitude*rad,end=b.latitude*rad;
  return Math.atan2(Math.sin(delta)*Math.cos(end),Math.cos(lat)*Math.sin(end)-Math.sin(lat)*Math.cos(end)*Math.cos(delta));
}
export function distanceKm(p,corridor){
  let nearest=Infinity;
  for(let i=1;i<corridor.length;i++){
    const a=corridor[i-1],b=corridor[i],dist=angular(a,p),angle=bearing(a,p)-bearing(a,b);
    const along=Math.atan2(Math.sin(dist)*Math.cos(angle),Math.cos(dist));
    const separation=along>0&&along<angular(a,b)?Math.abs(Math.asin(Math.sin(dist)*Math.sin(angle))):Math.min(dist,angular(b,p));
    nearest=Math.min(nearest,separation*6371.0088);
  }
  return nearest;
}
export function transitions(points){
  let outside=false;
  return points.flatMap(p=>{
    const next=p.distance_km>5;
    if(next===outside)return [];
    outside=next;
    return [{type:outside?'Deviation':'Reentry',...p}];
  });
}
export const detectDelays=pool=>pool.execute('UPDATE trip_routes SET delayed_at=deadline WHERE delayed_at IS NULL AND deadline<COALESCE(received_at,UTC_TIMESTAMP(3))');
export function trackingRouter(options,auth){
  const router=Router(),{pool}=options,trace=new ServiceClient({url:options.traceabilityUrl,secret:options.internalSecret,fetchImpl:options.fetchImpl});
  const run=fn=>async(req,res)=>{
    try{
      const id=uuid(req.params.lotId),tenant=req.identity.tenantId;
      const state=await trace.request('/internal/lots/'+id+'/state',{req});
      res.json(await fn(req,state,[tenant,id]));
    }catch(error){apiError(res,error);}
  };
  function carrier(req,state){
    if(state.custodianUserId!==req.identity.userId&&!req.identity.permissions.includes('shipments.supervise'))throw new OperationError(403,'NOT_CUSTODIAN','Se requiere el custodio del viaje');
  }
  router.post('/:lotId/route',auth,requirePermission('shipments.checkpoint'),run(async(req,state,ids)=>{
    carrier(req,state);
    const {corridor,minutes}=req.body??{};
    if(state.status!=='InTransit')throw invalid('El viaje debe estar en tránsito');
    if(!Array.isArray(corridor)||corridor.length<2||corridor.length>200||!corridor.every(valid)||!Number.isInteger(minutes)||minutes<1||minutes>43200)throw invalid('Indica la duración en minutos y de 2 a 200 coordenadas válidas');
    await transaction(pool,async db=>{
      await db.execute('INSERT INTO trip_routes(tenant_id,lot_id,corridor,deadline) VALUES(?,?,?,TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(3))) ON DUPLICATE KEY UPDATE lot_id=lot_id',[...ids,JSON.stringify(corridor),minutes*72]);
      const [[route]]=await db.execute('SELECT corridor,TIMESTAMPDIFF(SECOND,started_at,deadline) AS seconds FROM trip_routes WHERE tenant_id=? AND lot_id=?',ids);
      if(Number(route.seconds)!==minutes*72||route.corridor.length!==corridor.length||route.corridor.some((p,i)=>p.latitude!==corridor[i].latitude||p.longitude!==corridor[i].longitude))throw new OperationError(409,'ROUTE_EXISTS','El viaje ya cuenta con una ruta diferente');
    });
    return {status:'Active'};
  }));
  router.post('/:lotId/positions',auth,requirePermission('shipments.checkpoint'),run(async(req,state,ids)=>{
    const p=req.body??{},id=uuid(p.id),at=new Date(p.occurredAt);
    if(!valid(p)||!Number.isFinite(at.getTime())||at>Date.now()+30000)throw invalid('Punto GPS o fecha inválidos');
    return transaction(pool,async db=>{
      const [[route]]=await db.execute('SELECT * FROM trip_routes WHERE tenant_id=? AND lot_id=? FOR UPDATE',ids);
      if(!route)throw invalid('Configura el corredor del viaje');
      const [[prior]]=await db.execute('SELECT * FROM trip_positions WHERE tenant_id=? AND lot_id=? AND id=?',[...ids,id]);
      if(prior){
        if(prior.actor_id!==req.identity.userId||+prior.occurred_at!==+at||prior.latitude!==p.latitude||prior.longitude!==p.longitude)throw invalid('Identificador de captura en conflicto');
        return {id};
      }
      const custody=state.history.filter(event=>['CustodyAccepted','DelegationAccepted','PlantReceived'].includes(event.action)&&new Date(event.occurredAt)<=at).at(-1);
      if(custody?.action==='PlantReceived'||(route.received_at&&at>=route.received_at)||at<route.started_at)
        throw new OperationError(409,'TRIP_INACTIVE','Punto fuera del viaje');
      if(custody?.custodianUserId!==req.identity.userId&&!req.identity.permissions.includes('shipments.supervise'))throw new OperationError(403,'NOT_CUSTODIAN','No eras el custodio al capturar este punto');
      if(!custody)throw new OperationError(409,'TRIP_INACTIVE','Viaje fuera del periodo activo');
      await db.execute('INSERT INTO trip_positions(tenant_id,lot_id,id,actor_id,latitude,longitude,occurred_at,distance_km) VALUES(?,?,?,?,?,?,?,?)',[...ids,id,req.identity.userId,p.latitude,p.longitude,at,distanceKm(p,route.corridor)]);
      return {id};
    });
  }));
  router.get('/:lotId/route',auth,requirePermission('lots.read'),run(async(req,state,ids)=>{
    const [[route]]=await pool.execute('SELECT * FROM trip_routes WHERE tenant_id=? AND lot_id=?',ids);
    if(!route)return {route:null,alerts:[]};
    const [points]=await pool.execute('SELECT id,latitude,longitude,occurred_at,distance_km FROM trip_positions WHERE tenant_id=? AND lot_id=? ORDER BY occurred_at,id',ids);
    return {route:{...route,active:state.status==='InTransit'&&!route.received_at},points,alerts:[...transitions(points),...(route.delayed_at?[{type:'Delay',occurred_at:route.delayed_at}]:[])]};
  }));
  return router;
}
