const express = require('express');
const router = express.Router();

const db = require('../db/database');
const { authMiddleware, requireRole } = require('../middleware/auth');

// GET /api/logs?userId=&orderId=&action=
router.get('/', authMiddleware, requireRole(['admin', 'manager']), (req, res) => {
  const { userId, orderId, action } = req.query;

  let sql = 'SELECT * FROM activity_logs WHERE 1=1';
  const params = [];

  if (userId) {
    sql += ' AND userId = ?';
    params.push(userId);
  }
  if (orderId) {
    sql += ' AND orderId = ?';
    params.push(orderId);
  }
  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }

  sql += ' ORDER BY timestamp DESC';

  const logs = db.prepare(sql).all(...params);
  res.json(logs);
});

module.exports = router;
