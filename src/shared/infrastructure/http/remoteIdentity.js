export function createRemoteAuth({ identityUrl, internalSecret, fetchImpl = fetch }) {
  if (!identityUrl || !internalSecret) throw new Error('Configura IDENTITY_URL e INTERNAL_AUTH_SECRET');
  return async (req, res, next) => {
    try {
      const response = await fetchImpl(new URL('/internal/session', identityUrl), {
        headers: { cookie: req.headers.cookie ?? '', 'x-internal-secret': internalSecret },
        signal: AbortSignal.timeout(3000)
      });
      if (response.status === 401) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Inicia sesión para continuar' } });
      if (!response.ok) throw new Error('Identity unavailable');
      const body = await response.json();
      if (!body.identity?.tenantId || !body.identity?.userId || !Array.isArray(body.identity.permissions) || body.identity.permissions.some(p => typeof p !== 'string')) throw new Error('Invalid identity response');
      req.identity = body.identity;
      next();
    } catch {
      res.status(503).json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Autenticación temporalmente no disponible' } });
    }
  };
}
