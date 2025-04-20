const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, requireRole(['admin', 'manager']), (req, res) => {
  const users = db.prepare('SELECT id, username, role FROM users').all();
  res.json(users);
});

router.post('/', authMiddleware, requireRole(['admin', 'manager']), (req, res) => {
  const { username, password, role } = req.body;
  if (req.user.role === 'manager' && role === 'admin') {
    return res.status(403).json({ message: 'Managers cannot create Admins' });
  }

  const stmt = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
  const result = stmt.run(username, password, role);
  res.json({ message: 'User created', id: result.lastInsertRowid });
});

router.put('/:id', authMiddleware, requireRole(['admin', 'manager']), (req, res) => {
  const id = Number(req.params.id);
  const { password, role } = req.body;

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ message: 'User not found' });

  if (req.user.role === 'manager' && existing.role === 'admin') {
    return res.status(403).json({ message: 'Cannot modify Admin' });
  }

  db.prepare('UPDATE users SET password = ?, role = ? WHERE id = ?')
    .run(password || existing.password, role || existing.role, id);

  res.json({ message: 'User updated' });
});

router.delete('/:id', authMiddleware, requireRole(['admin', 'manager']), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ message: 'User not found' });

  if (req.user.role === 'manager' && existing.role === 'admin') {
    return res.status(403).json({ message: 'Cannot delete Admin' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ message: 'User deleted' });
});

module.exports = router;