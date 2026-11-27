import 'dotenv/config';
import {sandboxEnabled,deliverDemoCode} from './demoMailbox.js';
import { createMySqlPool } from '../../shared/infrastructure/persistence/mysql.js';
import { createIdentityApp } from './app.js';

if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL');
const pool = createMySqlPool(process.env.DATABASE_URL);
const app = createIdentityApp({ pool,
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173',
  internalSecret: process.env.INTERNAL_AUTH_SECRET,
  sendCode: sandboxEnabled()?deliverDemoCode:undefined,
  requireMfa: process.env.REQUIRE_MFA === 'true',
  secure: process.env.NODE_ENV === 'production' });
app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
