import { randomUUID } from 'node:crypto';

const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';
const password = process.env.SMOKE_PASSWORD;
if (!password) throw new Error('Configura SMOKE_PASSWORD');
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try { ready = (await fetch(`${base}/api/v1/health`)).ok; } catch { /* retry */ }
  if (ready) break;
  await new Promise(resolve => setTimeout(resolve, 1000));
}
if (!ready) throw new Error('Gateway no disponible');
const login = await fetch(`${base}/api/v1/auth/login`, { method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'smoke@example.test', password }) });
if (!login.ok) throw new Error(`Login: ${login.status}`);
const cookie = login.headers.get('set-cookie')?.split(';')[0];
if (!cookie) throw new Error('Cookie de sesión ausente');
const headers = { cookie, 'content-type': 'application/json' };
const registered = await fetch(`${base}/api/v1/lots`, { method: 'POST', headers,
  body: JSON.stringify({ clientEventId: randomUUID(), mineralType: 'Gold', weight: '125.5',
    weightUnit: 'kg', originEvidence: { reference: 'SMOKE', source: 'Prueba' } }) });
if (registered.status !== 201) throw new Error(`Registro: ${registered.status} ${await registered.text()}`);
const { lotId } = await registered.json();
const lookup = await fetch(`${base}/api/v1/lots/${lotId}`, { headers: { cookie } });
if (!lookup.ok) throw new Error(`Consulta: ${lookup.status}`);
const qr = await fetch(`${base}/api/v1/lots/${lotId}/qr`, { headers: { cookie } });
if (!qr.ok || !qr.headers.get('content-type')?.includes('image/png')) throw new Error(`QR: ${qr.status}`);
const logout = await fetch(`${base}/api/v1/auth/logout`, { method: 'POST', headers: { cookie } });
if (logout.status !== 204) throw new Error(`Logout: ${logout.status}`);
const denied = await fetch(`${base}/api/v1/lots/${lotId}`, { headers: { cookie } });
if (denied.status !== 401) throw new Error(`Sesión revocada: ${denied.status}`);
console.log('SMOKE PASS: identidad, registro, consulta, QR y revocación a través del gateway');
