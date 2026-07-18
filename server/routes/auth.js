import { Router } from 'express';
import { authenticate, signToken, authRequired, requireRole, audit } from '../auth/index.js';
import { query } from '../db.js';
import bcrypt from 'bcryptjs';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body || {};
    if (!login || !password) return res.status(400).json({ error: 'login and password required' });
    const user = await authenticate(login, password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user);
    await audit(user.id, 'login', 'auth', { login: user.login });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authRequired, async (req, res) => {
  res.json({ user: req.user });
});

router.get('/users', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(`SELECT id, login, role, created_at FROM users ORDER BY id`);
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { login, password, role } = req.body || {};
    if (!login || !password || !role) return res.status(400).json({ error: 'login, password, role required' });
    if (!['admin', 'editor', 'viewer'].includes(role)) return res.status(400).json({ error: 'invalid role' });
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (login, password_hash, role) VALUES ($1, $2, $3)
       RETURNING id, login, role, created_at`,
      [login, passwordHash, role],
    );
    await audit(req.user.id, 'create_user', 'users', { login, role });
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'User already exists' });
    res.status(500).json({ error: err.message });
  }
});

export default router;
