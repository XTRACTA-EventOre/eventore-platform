import 'dotenv/config';
import { createMySqlPool } from '../src/shared/infrastructure/persistence/mysql.js';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/shared/infrastructure/http/sessionAuth.js';
import { ROLE_PERMISSIONS } from '../src/shared/infrastructure/http/permissions.js';
const [email, tenantId, role = 'Operator'] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId ?? '')) {
  throw new Error('Uso: npm run user:create -- correo organización-UUID; contraseña en BOOTSTRAP_PASSWORD');
}
if (!Object.hasOwn(ROLE_PERMISSIONS, role)) throw new Error('Rol no válido');
if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL');
const passwordHash = await hashPassword(process.env.BOOTSTRAP_PASSWORD);
delete process.env.BOOTSTRAP_PASSWORD;
const pool = createMySqlPool(process.env.DATABASE_URL);
const tx = await pool.getConnection();
try {
  await tx.beginTransaction();
  const id = randomUUID();
  await tx.execute('INSERT INTO app_users(id,tenant_id,email,password_hash) VALUES(?,?,?,?)',
    [id, tenantId.toLowerCase(), email.trim().toLowerCase(), passwordHash]);
  await tx.execute('INSERT INTO app_user_roles(user_id,role_name) VALUES(?,?)', [id, role]);
  await tx.execute(`INSERT INTO access_audit(id,tenant_id,actor_id,target_user_id,previous_roles,assigned_roles)
    VALUES(?,?,'system:provisioning',?,JSON_ARRAY(),?)`, [randomUUID(), tenantId.toLowerCase(), id, JSON.stringify([role])]);
  await tx.commit();
  console.log('Usuario creado. No se ha sobrescrito ninguna cuenta existente.');
} catch (error) { await tx.rollback(); throw error; }
finally { tx.release(); await pool.end(); }
