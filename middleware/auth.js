const db = require('../db/database');

function authMiddleware(req, res, next) {
  const userId = parseInt(req.headers.userid);
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  req.user = user;
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient rights' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };