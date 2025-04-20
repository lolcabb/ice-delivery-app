const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Login using username and password
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  const user = db.prepare('SELECT id, username, role FROM users WHERE username = ? AND password = ?').get(username, password);
  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

module.exports = router;