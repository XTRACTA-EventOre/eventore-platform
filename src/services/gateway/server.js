import 'dotenv/config';
import { createGatewayApp } from './app.js';

const app = createGatewayApp({ identityUrl: process.env.IDENTITY_URL,
  traceabilityUrl: process.env.TRACEABILITY_URL,
  logisticsUrl: process.env.LOGISTICS_URL,
  processingUrl: process.env.PROCESSING_URL,
  devicesUrl: process.env.DEVICES_URL,
  reportingUrl: process.env.REPORTING_URL,
  jewelryUrl: process.env.JEWELRY_URL,
  certificationUrl: process.env.CERTIFICATION_URL,
  appBaseUrl: process.env.APP_BASE_URL });
app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
