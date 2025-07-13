const router = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const waterController = require('../controllers/waterController');

// Get water quality logs and add a new log
router.route('/logs')
    .get(authMiddleware, waterController.getAllWaterLogs)
    .post(authMiddleware, waterController.addWaterLog); // Accessible by any authenticated user

// Get all defined water test stages
router.route('/stages')
    .get(authMiddleware, waterController.getTestStages);

module.exports = router;