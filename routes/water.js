const router = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const waterController = require('../controllers/waterController');

// Get water quality logs and add a new log
router.route('/logs')
    .get(authMiddleware, waterController.getAllWaterLogs)
    .post(authMiddleware, waterController.addWaterLog) // Accessible by any authenticated user
    .delete(authMiddleware, requireRole(['admin']), waterController.deleteWaterLogsByDate);

// NEW: Upsert (update/insert) water logs
router.put('/logs/upsert', authMiddleware, waterController.upsertWaterLogs);    

// Get recent water logs over a date range (defaults to last 7 days)
router.route('/logs/recent')
    .get(authMiddleware, waterController.getRecentWaterLogs);

// Get all defined water test stages
router.route('/stages')
    .get(authMiddleware, waterController.getTestStages);

module.exports = router;