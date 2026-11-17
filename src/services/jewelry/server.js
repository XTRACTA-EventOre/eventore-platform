import 'dotenv/config';
import { createMySqlPool } from '../../shared/infrastructure/persistence/mysql.js';
import { createJewelryApp } from './app.js';
createJewelryApp({pool:createMySqlPool(process.env.DATABASE_URL),identityUrl:process.env.IDENTITY_URL,traceabilityUrl:process.env.TRACEABILITY_URL,internalSecret:process.env.INTERNAL_AUTH_SECRET,appBaseUrl:process.env.APP_BASE_URL??'http://localhost:5173'}).listen(Number(process.env.PORT??3005),'0.0.0.0');
