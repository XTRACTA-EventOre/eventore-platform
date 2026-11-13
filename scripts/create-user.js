import 'dotenv/config';
import { createMySqlPool } from '../src/shared/infrastructure/persistence/mysql.js';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/shared/infrastructure/http/sessionAuth.js';
const [email, tenantId] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId ?? '')) {
  throw new Error('Uso: npm run user:create -- correo organización-UUID; contraseña en BOOTSTRAP_PASSWORD');
}
if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL');
const passwordHash = await hashPassword(process.env.BOOTSTRAP_PASSWORD);
delete process.env.BOOTSTRAP_PASSWORD;
const pool = createMySqlPool(process.env.DATABASE_URL);
try {
  await pool.execute('INSERT INTO app_users(id,tenant_id,email,password_hash) VALUES(?,?,?,?)',
    [randomUUID(), tenantId.toLowerCase(), email.trim().toLowerCase(), passwordHash]);
  console.log('Usuario creado. No se ha sobrescrito ninguna cuenta existente.');
} finally { await pool.end(); }
