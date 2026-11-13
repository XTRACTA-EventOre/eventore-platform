import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { ROLE_PERMISSIONS, requirePermission } from '../../shared/infrastructure/http/permissions.js';

export function createAccessRouter({ pool, authenticate }) {
  const router = Router();
  router.use(authenticate);
  router.get('/roles', requirePermission('users.manage'), (_req, res) => res.json({ roles: ROLE_PERMISSIONS }));
  router.get('/transporters', requirePermission('lots.release'), async (req, res) => {
    try {
      const [users] = await pool.execute(`SELECT u.id,u.email FROM app_users u
        JOIN app_user_roles r ON r.user_id=u.id WHERE u.tenant_id=? AND u.active=true
        AND r.role_name='Transporter' ORDER BY u.email`, [req.identity.tenantId]);
      res.json({ users });
    } catch { res.status(503).json({ error: { code: 'ACCESS_UNAVAILABLE', message: 'No se pudo consultar transportistas' } }); }
  });
  router.get('/users', requirePermission('users.manage'), async (req, res) => {
    try {
      const [users] = await pool.execute('SELECT id,email,active FROM app_users WHERE tenant_id=? ORDER BY email', [req.identity.tenantId]);
      const [roles] = await pool.execute(`SELECT r.user_id,r.role_name FROM app_user_roles r
        JOIN app_users u ON u.id=r.user_id WHERE u.tenant_id=?`, [req.identity.tenantId]);
      res.json({ users: users.map(user => ({ ...user, active: Boolean(user.active),
        roles: roles.filter(role => role.user_id === user.id).map(role => role.role_name).sort() })) });
    } catch { res.status(503).json({ error: { code: 'ACCESS_UNAVAILABLE', message: 'No se pudo consultar usuarios' } }); }
  });
  router.put('/users/:userId/roles', requirePermission('users.manage'), async (req, res) => {
    const roles = req.body?.roles;
    if (!Array.isArray(roles) || !roles.length || roles.length > Object.keys(ROLE_PERMISSIONS).length ||
      new Set(roles).size !== roles.length || roles.some(role => !Object.hasOwn(ROLE_PERMISSIONS, role))) {
      return res.status(400).json({ error: { code: 'INVALID_ROLES', message: 'Selecciona roles válidos sin repetir' } });
    }
    const tenantId = req.identity.tenantId;
    let tx;
    try {
      tx = await pool.getConnection(); await tx.beginTransaction();
      await tx.execute('INSERT INTO tenant_access_guards(tenant_id) VALUES(?) ON DUPLICATE KEY UPDATE tenant_id=tenant_access_guards.tenant_id', [tenantId]);
      await tx.execute('SELECT tenant_id FROM tenant_access_guards WHERE tenant_id=? FOR UPDATE', [tenantId]);
      // Recheck the administrator inside the serialized transaction; concurrent revocations take effect.
      const [actors] = await tx.execute(`SELECT u.id FROM app_users u JOIN app_user_roles r ON r.user_id=u.id
        WHERE u.id=? AND u.tenant_id=? AND u.active=true AND r.role_name='Administrator'`, [req.identity.userId, tenantId]);
      if (!actors.length) { await tx.rollback(); return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permiso de administración revocado' } }); }
      const [users] = await tx.execute('SELECT id,active FROM app_users WHERE id=? AND tenant_id=? FOR UPDATE', [req.params.userId, tenantId]);
      if (!users.length) { await tx.rollback(); return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' } }); }
      const [before] = await tx.execute('SELECT role_name FROM app_user_roles WHERE user_id=? ORDER BY role_name', [users[0].id]);
      if (users[0].active && before.some(r => r.role_name === 'Administrator') && !roles.includes('Administrator')) {
        const [[{ n }]] = await tx.execute(`SELECT COUNT(*) AS n FROM app_users u JOIN app_user_roles r ON r.user_id=u.id
          WHERE u.tenant_id=? AND u.active=true AND r.role_name='Administrator'`, [tenantId]);
        if (Number(n) <= 1) { await tx.rollback(); return res.status(409).json({ error: { code: 'LAST_ADMINISTRATOR', message: 'Debe permanecer un administrador activo' } }); }
      }
      await tx.execute('DELETE FROM app_user_roles WHERE user_id=?', [users[0].id]);
      for (const role of roles) await tx.execute('INSERT INTO app_user_roles(user_id,role_name) VALUES(?,?)', [users[0].id, role]);
      await tx.execute(`INSERT INTO access_audit(id,tenant_id,actor_id,target_user_id,previous_roles,assigned_roles)
        VALUES(?,?,?,?,?,?)`, [randomUUID(), tenantId, req.identity.userId, users[0].id,
        JSON.stringify(before.map(r => r.role_name)), JSON.stringify([...roles].sort())]);
      await tx.commit(); res.json({ userId: users[0].id, roles: [...roles].sort() });
    } catch { if (tx) await tx.rollback().catch(() => {}); res.status(503).json({ error: { code: 'ACCESS_NOT_CONFIRMED', message: 'No se confirmó el cambio de roles' } }); }
    finally { tx?.release(); }
  });
  return router;
}
