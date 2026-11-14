import 'dotenv/config';
import {createMySqlPool} from '../../shared/infrastructure/persistence/mysql.js';
import {createDevicesApp} from './app.js';
const pool=createMySqlPool(process.env.DATABASE_URL),app=createDevicesApp({pool,identityUrl:process.env.IDENTITY_URL,traceabilityUrl:process.env.TRACEABILITY_URL,internalSecret:process.env.INTERNAL_AUTH_SECRET,appBaseUrl:process.env.APP_BASE_URL??'http://localhost:5173'});
let evaluating=false;
const timer=setInterval(async()=>{if(evaluating)return;evaluating=true;try{await app.locals.deviceService.evaluate();}catch{console.error('No se pudo evaluar disponibilidad de dispositivos');}finally{evaluating=false;}},30000);timer.unref();
const server=app.listen(Number(process.env.PORT??3007),'0.0.0.0');
process.on('SIGTERM',()=>{clearInterval(timer);server.close(()=>{void pool.end();});});
