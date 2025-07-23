const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

router.post('/', authMiddleware, orderController.createOrder);
router.get('/', authMiddleware, orderController.getOrders);
router.get('/today', authMiddleware, orderController.getTodayOrders);
router.get('/:id', authMiddleware, orderController.getOrder);
router.put('/:id', authMiddleware, orderController.updateOrder);
router.delete('/:id', authMiddleware, requireRole(['admin','manager']), orderController.deleteOrder);

module.exports = router;
