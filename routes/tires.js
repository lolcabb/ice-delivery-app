const router = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const tireController = require('../controllers/tireController');

// Get all tires & add a new tire
router.route('/')
    .get(authMiddleware, tireController.getAllTires)
    .post(authMiddleware, requireRole(['admin', 'manager', 'accountant', 'staff']), tireController.addTire);

// Get all tire assignments
router.route('/assignments')
    .get(authMiddleware, tireController.getAllAssignments);
    
// Get and update a single tire
router.route('/:id')
    .get(authMiddleware, tireController.getTireById)
    .put(authMiddleware, requireRole(['admin', 'manager', 'accountant', 'staff']), tireController.updateTire);

// Assign a tire to a vehicle
router.route('/assign')
    .post(authMiddleware, requireRole(['admin', 'manager', 'accountant', 'staff']), tireController.assignTire);

// Unmount a tire
router.route('/unmount/:tireId')
    .put(authMiddleware, requireRole(['admin', 'manager', 'accountant', 'staff']), tireController.unmountTire);

module.exports = router;