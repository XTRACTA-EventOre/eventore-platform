export const ROLE_PERMISSIONS = Object.freeze({
  Administrator: ['users.manage', 'lots.read', 'lots.register', 'lots.cancel', 'lots.release', 'shipments.checkpoint', 'shipments.report', 'shipments.review', 'shipments.receive', 'shipments.weigh', 'shipments.supervise', 'processing.manage', 'inventory.manage', 'certificates.request', 'certificates.read', 'certificates.review', 'certificates.revoke', 'evidence.review'],
  Supervisor: ['lots.read', 'lots.register', 'lots.cancel', 'lots.release', 'shipments.checkpoint', 'shipments.review', 'shipments.weigh', 'shipments.supervise'],
  Operator: ['lots.read', 'lots.register'],
  Transporter: ['lots.read', 'custody.accept', 'shipments.checkpoint', 'shipments.report', 'shipments.delegate'],
  Viewer: ['lots.read'],
  PlantOperator: ['lots.read', 'shipments.checkpoint', 'shipments.weigh', 'shipments.receive', 'shipments.review', 'processing.manage'],
  Jeweler: ['lots.read', 'inventory.manage', 'certificates.request', 'certificates.read'],
  Certifier: ['lots.read', 'evidence.review', 'certificates.review', 'certificates.read']
});

export function accessForRoles(roles) {
  return { roles, permissions: [...new Set(roles.flatMap(role => ROLE_PERMISSIONS[role] ?? []))].sort() };
}

export function requireAnyPermission(...permissions) {
  return (req, res, next) => {
    if (permissions.some(permission => req.identity?.permissions?.includes(permission))) return next();
    return requirePermission(permissions[0])(req, res, next);
  };
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
