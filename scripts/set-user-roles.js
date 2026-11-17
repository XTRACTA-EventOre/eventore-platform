import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createMySqlPool } from '../src/shared/infrastructure/persistence/mysql.js';
import { ROLE_PERMISSIONS } from '../src/shared/infrastructure/http/permissions.js';

// Out-of-band provisioning; requires direct database credentials, never exposed as an API.
const [email, tenantId, role] = process.argv.slice(2);
if (!email || !/^[0-9a-f-]{36}$/i.test(tenantId ?? '') || !Object.hasOwn(ROLE_PERMISSIONS, role)) {
  throw new Error('Uso: npm run user:roles -- correo organización-UUID Administrator|Supervisor|Operator|Transporter|Viewer');
}
const pool = createMySqlPool(process.env.DATABASE_URL), tx = await pool.getConnection();
try {
  await tx.beginTransaction();
  await tx.execute('INSERT INTO tenant_access_guards(tenant_id) VALUES(?) ON DUPLICATE KEY UPDATE tenant_id=tenant_access_guards.tenant_id', [tenantId.toLowerCase()]);
  await tx.execute('SELECT tenant_id FROM tenant_access_guards WHERE tenant_id=? FOR UPDATE', [tenantId.toLowerCase()]);
  const [[user]] = await tx.execute('SELECT id FROM app_users WHERE email=? AND tenant_id=? FOR UPDATE', [email.trim().toLowerCase(), tenantId.toLowerCase()]);
  if (!user) throw new Error('Usuario no encontrado en esa organización');
  const [before] = await tx.execute('SELECT role_name FROM app_user_roles WHERE user_id=?', [user.id]);
  await tx.execute('DELETE FROM app_user_roles WHERE user_id=?', [user.id]);
  await tx.execute('INSERT INTO app_user_roles(user_id,role_name) VALUES(?,?)', [user.id, role]);
  await tx.execute(`INSERT INTO access_audit(id,tenant_id,actor_id,target_user_id,previous_roles,assigned_roles)
    VALUES(?,?,'system:provisioning',?,?,?)`, [randomUUID(), tenantId.toLowerCase(), user.id,
    JSON.stringify(before.map(row => row.role_name)), JSON.stringify([role])]);
  await tx.commit(); console.log('Rol provisionado y cambio auditado.');
} catch (error) { await tx.rollback(); throw error; }
finally { tx.release(); await pool.end(); }
