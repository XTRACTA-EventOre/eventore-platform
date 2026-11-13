import 'dotenv/config';
import { createGatewayApp } from './app.js';

const app = createGatewayApp({ identityUrl: process.env.IDENTITY_URL,
  traceabilityUrl: process.env.TRACEABILITY_URL,
  logisticsUrl: process.env.LOGISTICS_URL,
  appBaseUrl: process.env.APP_BASE_URL });
app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
