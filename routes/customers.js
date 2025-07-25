const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { body } = require('express-validator');
const customerController = require('../controllers/customerController');
const { getConfig } = require('../config/index.js');
const { GCS_BUCKET_NAME } = getConfig();

router.get('/customers/search', authMiddleware, customerController.searchCustomers);
router.get('/routes/:route_id/analytics', authMiddleware, customerController.getRouteAnalytics);

router.get('/delivery-routes', authMiddleware, requireRole(['admin','accountant','manager','staff']), customerController.getDeliveryRoutes);
router.post('/delivery-routes', authMiddleware, requireRole(['admin','accountant','manager']), customerController.createDeliveryRoute);
router.put('/delivery-routes/:id', authMiddleware, requireRole(['admin','accountant','manager']), customerController.updateDeliveryRoute);
router.delete('/delivery-routes/:id', authMiddleware, requireRole(['admin','accountant']), customerController.deleteDeliveryRoute);

router.get('/:customerId/credit-sales', authMiddleware, requireRole(['admin','accountant','manager','staff']), customerController.getCreditSales);
router.post('/:customerId/credit-payments', authMiddleware, requireRole(['admin','accountant','manager','staff']), customerController.createCreditPayment);
router.get('/:customerId/credit-payments', authMiddleware, requireRole(['admin','accountant','manager','staff']), customerController.getCreditPayments);
router.post('/credit-payments/:paymentId/void', authMiddleware, requireRole(['admin','manager']), customerController.voidCreditPayment);
router.put('/credit-payments/:paymentId', authMiddleware, requireRole(['admin','manager']), customerController.editCreditPayment);

router.post('/',
  authMiddleware,
  requireRole(['admin','accountant','manager','staff']),
  validate([body('name').notEmpty().withMessage('Name is required')]),
  customerController.createCustomer
);
router.get('/', authMiddleware, requireRole(['admin','accountant','manager','staff']), customerController.listCustomers);
router.get('/:id', authMiddleware, requireRole(['admin','accountant','manager','staff']), customerController.getCustomer);
router.put('/:id', authMiddleware, requireRole(['admin','accountant','manager','staff']), customerController.updateCustomer);
router.delete('/:id', authMiddleware, requireRole(['admin','accountant']), customerController.deleteCustomer);

module.exports = router;
