// ice-delivery-app/routes/salesOperations.js
const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const salesOpsController = require('../controllers/salesOperationsController');

router.get('/routes/:routeId/customers', authMiddleware, salesOpsController.getRouteCustomers);
router.post('/routes/:routeId/customers', authMiddleware, salesOpsController.addRouteCustomer);
router.delete('/routes/:routeId/customers/:customerId', authMiddleware, salesOpsController.removeRouteCustomer);
router.put('/routes/:routeId/customer-order', authMiddleware, salesOpsController.updateRouteCustomerOrder);
router.get('/customers/:customer_id/prices', authMiddleware, salesOpsController.getCustomerPrices);
router.put('/customers/:customer_id/prices/:product_id', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.updateCustomerPrice);
router.post('/sales-entry/batch', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.batchSalesEntry);
router.get('/driver-sales/edit/:summary_id', authMiddleware, salesOpsController.getDriverSalesForEdit);
router.put('/driver-sales/:sale_id', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.updateDriverSaleSimple);
router.delete('/driver-sales/:sale_id', authMiddleware, requireRole(['admin','manager']), salesOpsController.deleteDriverSaleSimple);
router.post('/batch-returns', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.batchReturns);
router.get('/reconciliation-summary', authMiddleware, requireRole(['admin','manager','staff','accountant']), salesOpsController.getReconciliationSummary);
router.get('/products', authMiddleware, requireRole(['admin','manager','staff','accountant']), salesOpsController.getProducts);
router.post('/loading-logs', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.createLoadingLogs);
// Optional query parameters: driver_id, route_id, load_type, batch_uuid, date (YYYY-MM-DD)
router.get('/loading-logs', authMiddleware, requireRole(['admin','manager','staff','accountant']), salesOpsController.getLoadingLogs);
router.put('/loading-logs/batch/:batchUUID', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.updateLoadingLogBatch);
router.post('/driver-daily-summaries', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.createDriverDailySummary);
router.get('/driver-daily-summaries', authMiddleware, requireRole(['admin','manager','staff','accountant']), salesOpsController.getDriverDailySummaries);
router.put('/driver-daily-summaries/:summaryId', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.updateDriverDailySummary);
router.put('/driver-daily-summaries/:summaryId/reconcile', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.reconcileDriverDailySummary);
router.post('/driver-sales', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.createDriverSale);
router.get('/driver-sales', authMiddleware, requireRole(['admin','manager','staff','accountant']), salesOpsController.getDriverSales);
router.put('/driver-sales/:saleId', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.updateDriverSale);
router.delete('/driver-sales/:saleId', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.deleteDriverSale);
router.get('/loss-reasons', authMiddleware, requireRole(['admin','manager','staff','accountant']), salesOpsController.getLossReasons);
router.post('/product-returns', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.createProductReturns);
router.get('/product-returns', authMiddleware, requireRole(['admin','manager','staff','accountant']), salesOpsController.getProductReturns);
router.get('/packaging-types', authMiddleware, requireRole(['admin','manager','staff','accountant']), salesOpsController.getPackagingTypes);
router.post('/packaging-logs', authMiddleware, requireRole(['admin','manager','staff']), salesOpsController.createPackagingLog);
router.get('/packaging-logs', authMiddleware, requireRole(['admin','manager','staff','accountant']), salesOpsController.getPackagingLogs);

module.exports = router;
