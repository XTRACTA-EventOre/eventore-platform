import 'dotenv/config';
import { createMySqlPool } from '../../shared/infrastructure/persistence/mysql.js';
import { createCertificationApp } from './app.js';
createCertificationApp({pool:createMySqlPool(process.env.DATABASE_URL),identityUrl:process.env.IDENTITY_URL,traceabilityUrl:process.env.TRACEABILITY_URL,jewelryUrl:process.env.JEWELRY_URL,internalSecret:process.env.INTERNAL_AUTH_SECRET,appBaseUrl:process.env.APP_BASE_URL??'http://localhost:5173'}).listen(Number(process.env.PORT??3006),'0.0.0.0');
