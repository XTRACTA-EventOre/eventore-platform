import {fileURLToPath} from 'node:url';
import express from 'express';
import {createRemoteAuth} from '../../shared/infrastructure/http/remoteIdentity.js';
import {createSessionAuth} from '../../shared/infrastructure/http/sessionAuth.js';
import {requirePermission} from '../../shared/infrastructure/http/permissions.js';
import {uuid,text,version,apiError} from '../../shared/infrastructure/http/operationHttp.js';
import {DeviceService} from './DeviceService.js';
export function createDevicesApp(options){
 const{identityUrl,internalSecret,appBaseUrl,fetchImpl=fetch}=options,app=express(),service=new DeviceService(options);
 app.disable('x-powered-by');app.use(express.json());app.use(createSessionAuth({pool:null,appBaseUrl}).sameOrigin);
 const auth=createRemoteAuth({identityUrl,internalSecret,fetchImpl}),handle=fn=>async(req,res)=>{try{res.set('Cache-Control','no-store');res.json(await fn(req));}catch(error){apiError(res,error);}};
 app.locals.deviceService=service;
 app.get('/api/v1/devices/openapi.json',(_req,res)=>res.sendFile(fileURLToPath(new URL('../../../docs/devices-openapi.json',import.meta.url))));
 app.get('/health',(_req,res)=>res.json({status:'ok',service:'devices'}));
 app.post('/api/v1/devices/:id/readings',handle(req=>service.ingest(uuid(req.params.id),/^Bearer (\S+)$/.exec(req.get('authorization')??'')?.[1],req.body??{})));
 app.get('/api/v1/devices',auth,requirePermission('lots.read'),handle(async req=>{await service.evaluate(req.identity.tenantId);return {devices:await service.list(req.identity.tenantId)};}));
 app.get('/api/v1/devices/:id',auth,requirePermission('lots.read'),handle(async req=>{await service.evaluate(req.identity.tenantId);return service.read(req.identity.tenantId,uuid(req.params.id));}));
 app.post('/api/v1/devices',auth,requirePermission('devices.manage'),handle(req=>service.register({tenantId:req.identity.tenantId,actorId:req.identity.userId,operationId:uuid(req.body?.operationId),action:'Registered',serial:text(req.body?.serial,'Identificador de dispositivo',100),name:text(req.body?.name,'Nombre de dispositivo',200),lotId:uuid(req.body?.lotId)},req)));
 app.post('/api/v1/devices/:id/credentials',auth,requirePermission('devices.manage'),handle(req=>service.credential(req.identity.tenantId,uuid(req.params.id),req.identity.userId)));
 const command=(req,action)=>({tenantId:req.identity.tenantId,actorId:req.identity.userId,operationId:uuid(req.body?.operationId),deviceId:uuid(req.params.id),expectedVersion:version(req.body?.expectedVersion),action});
 app.post('/api/v1/devices/:id/calibrations',auth,requirePermission('devices.manage'),handle(req=>service.change({...command(req,'Calibrated'),calibratedAt:req.body?.calibratedAt,expiresAt:req.body?.expiresAt,evidenceRef:text(req.body?.evidenceRef,'Evidencia de calibración')})));
 app.post('/api/v1/devices/:id/deactivation',auth,requirePermission('devices.disable'),handle(req=>service.change({...command(req,'Disabled'),reason:text(req.body?.reason,'Motivo de desactivación'),acknowledgeOperationalImpact:req.body?.acknowledgeOperationalImpact===true})));
 return app;
}
