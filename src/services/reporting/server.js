import 'dotenv/config';
import {createMySqlPool} from '../../shared/infrastructure/persistence/mysql.js';
import {createReportingApp} from './app.js';
const pool=createMySqlPool(process.env.DATABASE_URL),app=createReportingApp({pool,identityUrl:process.env.IDENTITY_URL,traceabilityUrl:process.env.TRACEABILITY_URL,internalSecret:process.env.INTERNAL_AUTH_SECRET,appBaseUrl:process.env.APP_BASE_URL??'http://localhost:5173'});
let running=false;const timer=setInterval(async()=>{if(running)return;running=true;try{await app.locals.reportingService.resume();}catch{console.error('Exportaciones pendientes sin confirmar');}finally{running=false;}},10000);timer.unref();
const server=app.listen(Number(process.env.PORT??3008),'0.0.0.0');process.on('SIGTERM',()=>{clearInterval(timer);server.close(()=>{void pool.end();});});
