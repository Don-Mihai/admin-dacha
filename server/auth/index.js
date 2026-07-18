import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';

export async function ensureAdminUser() {
  const existing = await query('SELECT id FROM users WHERE login = $1', [config.adminLogin]);
  if (existing.rows.length) return;

  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  await query(
    `INSERT INTO users (login, password_hash, role) VALUES ($1, $2, 'admin')`,
    [config.adminLogin, passwordHash],
  );
  console.log(`Created admin user: ${config.adminLogin}`);
}

export async function authenticate(login, password) {
  const result = await query('SELECT id, login, password_hash, role FROM users WHERE login = $1', [login]);
  const user = result.rows[0];
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return { id: user.id, login: user.login, role: user.role };
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, login: user.login, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, login: payload.login, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

export async function audit(userId, action, entity, meta = null) {
  await query(
    `INSERT INTO audit_log (user_id, action, entity, meta) VALUES ($1, $2, $3, $4)`,
    [userId ?? null, action, entity, meta ? JSON.stringify(meta) : null],
  );
}
