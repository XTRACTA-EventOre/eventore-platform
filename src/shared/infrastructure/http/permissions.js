export const ROLE_PERMISSIONS = Object.freeze({
  Administrator: ['users.manage', 'lots.read', 'lots.register', 'lots.cancel', 'lots.release'],
  Supervisor: ['lots.read', 'lots.register', 'lots.cancel', 'lots.release'],
  Operator: ['lots.read', 'lots.register'],
  Transporter: ['lots.read', 'custody.accept'],
  Viewer: ['lots.read']
});

export function accessForRoles(roles) {
  return { roles, permissions: [...new Set(roles.flatMap(role => ROLE_PERMISSIONS[role] ?? []))].sort() };
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.identity?.userId || !req.identity?.tenantId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Inicia sesión para continuar' } });
    }
    if (!req.identity.permissions?.includes(permission)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No tienes permiso para esta operación' } });
    }
    next();
  };
}
