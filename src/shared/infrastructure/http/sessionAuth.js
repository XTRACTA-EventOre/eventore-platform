import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { Router } from 'express';

const scrypt = promisify(derive);
const digest = value => createHash('sha256').update(value).digest('hex');
const cookieName = 'eventore_session';
const lifetime = 8 * 60 * 60 * 1000;

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('La contraseña debe contener entre 12 y 128 caracteres');
  }
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [salt, hex] = encoded.split(':');
  const expected = Buffer.from(hex, 'hex');
  const actual = await scrypt(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sessionToken(req) {
  const cookie = req.headers.cookie?.split(';').map(v => v.trim())
    .find(v => v.startsWith(`${cookieName}=`));
  const value = cookie?.slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/.test(value ?? '') ? value : null;
}

export function createSessionAuth({ pool, appBaseUrl, secure = false }) {
  const origin = new URL(appBaseUrl).origin;
  const options = { httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge: lifetime };
  const unauthorized = res => res.status(401).json({ error: {
    code: 'UNAUTHORIZED', message: 'Inicia sesión para continuar' } });
  const identity = row => ({ userId: row.id, tenantId: row.tenant_id, email: row.email });
  const unavailable = res => res.status(503).json({ error: {
    code: 'AUTH_UNAVAILABLE', message: 'Autenticación temporalmente no disponible' } });
  const authenticate = async (req, res, next) => {
    if (!pool) return unavailable(res);
    const token = sessionToken(req);
    if (!token) return unauthorized(res);
    try {
      const { rows } = await pool.query(`SELECT u.id,u.tenant_id,u.email
        FROM app_sessions s JOIN app_users u ON u.id=s.user_id
        WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true`, [digest(token)]);
      if (!rows[0]) return unauthorized(res);
      req.identity = identity(rows[0]);
      next();
    } catch { return unavailable(res); }
  };
  const sameOrigin = (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site')) {
      return res.status(403).json({ error: { code: 'INVALID_ORIGIN', message: 'Origen no autorizado' } });
    }
    next();
  };
  const router = Router();
  router.post('/login', async (req, res) => {
    if (!pool) return unavailable(res);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body?.password;
    if (!email || email.length > 254 || typeof password !== 'string' || password.length > 128) return unauthorized(res);
    let tx;
    try {
      tx = await pool.connect(); await tx.query('BEGIN');
      const { rows } = await tx.query('SELECT * FROM app_users WHERE email=$1 FOR UPDATE', [email]);
      const user = rows[0];
      if (!user || !user.active || (user.locked_until && new Date(user.locked_until) > new Date())) {
        await tx.query('COMMIT'); return unauthorized(res);
      }
      if (!await verifyPassword(password, user.password_hash)) {
        await tx.query(`UPDATE app_users SET
          failed_attempts=CASE WHEN locked_until<=now() THEN 1 ELSE failed_attempts+1 END,
          locked_until=CASE WHEN locked_until<=now() THEN NULL
            WHEN failed_attempts+1>=3 THEN now()+interval '15 minutes' ELSE locked_until END
          WHERE id=$1`, [user.id]);
        await tx.query('COMMIT'); return unauthorized(res);
      }
      await tx.query('UPDATE app_users SET failed_attempts=0,locked_until=NULL WHERE id=$1', [user.id]);
      await tx.query('DELETE FROM app_sessions WHERE expires_at<=now()');
      const token = randomBytes(32).toString('hex');
      await tx.query('INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',
        [digest(token), user.id, new Date(Date.now() + lifetime)]);
      await tx.query('COMMIT');
      res.cookie(cookieName, token, options).json({ identity: identity(user) });
    } catch { if (tx) await tx.query('ROLLBACK').catch(() => {}); return unavailable(res); }
    finally { tx?.release(); }
  });
  router.get('/session', authenticate, (req, res) => res.json({ identity: req.identity }));
  router.post('/logout', async (req, res) => {
    const token = sessionToken(req);
    try { if (pool && token) await pool.query('DELETE FROM app_sessions WHERE token_hash=$1', [digest(token)]); }
    catch { return unavailable(res); }
    res.clearCookie(cookieName, { ...options, maxAge: undefined }).status(204).end();
  });
  return { router, authenticate, sameOrigin };
}
