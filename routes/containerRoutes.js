const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const containerController = require('../controllers/containerController');
const { SOME_CONFIG } = require('../config/index.js');

router.get('/sizes', authMiddleware, requireRole(['admin','accountant','staff','manager']), containerController.getContainerSizes);
router.post('/sizes', authMiddleware, requireRole(['admin','accountant','manager']), containerController.createContainerSize);
router.put('/sizes/:id', authMiddleware, requireRole(['admin','accountant','manager']), containerController.updateContainerSize);
router.delete('/sizes/:id', authMiddleware, requireRole(['admin','accountant','manager']), containerController.deleteContainerSize);

router.get('/return-reasons', authMiddleware, requireRole(['admin','accountant','staff','manager']), containerController.getReturnReasons);
router.post('/return-reasons', authMiddleware, requireRole(['admin','accountant','staff','manager']), containerController.createReturnReason);
router.put('/return-reasons/:id', authMiddleware, requireRole(['admin','accountant','staff','manager']), containerController.updateReturnReason);
router.delete('/return-reasons/:id', authMiddleware, requireRole(['admin','accountant','staff','manager']), containerController.deleteReturnReason);

router.post('/items', authMiddleware, requireRole(['admin','accountant','staff','manager']), containerController.addContainerItem);
router.get('/items', authMiddleware, requireRole(['admin','accountant','staff','manager']), containerController.listContainerItems);
router.get('/items/:id', authMiddleware, requireRole(['admin','accountant','staff','manager']), containerController.getContainerById);
router.put('/items/:id', authMiddleware, requireRole(['admin','accountant','staff','manager']), containerController.updateContainer);
router.delete('/items/:id', authMiddleware, requireRole(['admin','accountant']), containerController.deleteContainer);

router.post('/items/:containerId/assign', authMiddleware, requireRole(['admin','accountant','staff','manager']), containerController.assignContainer);
router.put('/assignments/:assignmentId', authMiddleware, requireRole(['admin','manager','accountant','staff']), containerController.updateAssignment);
router.put('/assignments/:assignmentId/return', authMiddleware, requireRole(['admin','accountant','staff','manager']), containerController.returnContainer);
router.get('/items/:containerId/assignments', authMiddleware, requireRole(['admin','accountant','staff','manager']), containerController.getAssignmentsForContainer);
router.get('/assignments', authMiddleware, requireRole(['admin','accountant','manager','staff']), containerController.listAssignments);

module.exports = router;
