import 'dotenv/config';
import { createMySqlPool } from '../../shared/infrastructure/persistence/mysql.js';
import { createProcessingApp } from './app.js';
createProcessingApp({pool:createMySqlPool(process.env.DATABASE_URL),identityUrl:process.env.IDENTITY_URL,
  traceabilityUrl:process.env.TRACEABILITY_URL,internalSecret:process.env.INTERNAL_AUTH_SECRET,
  appBaseUrl:process.env.APP_BASE_URL??'http://localhost:5173'})
  .listen(Number(process.env.PORT??3004),'0.0.0.0');
