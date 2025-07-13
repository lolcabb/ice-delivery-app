const router = require('express').Router();
const { authMiddleware, requireRole } = require('../middleware/auth'); // Assuming this is the correct path
const vehicleController = require('../controllers/vehicleController');

// Get all vehicles & add a new vehicle
router.route('/')
    .get(authMiddleware, vehicleController.getAllVehicles) // Accessible by any authenticated user
    .post(authMiddleware, requireRole(['admin', 'manager', 'accountant', 'staff']), vehicleController.addVehicle);

// Get, update, and delete a single vehicle by its ID
router.route('/:id')
    .get(authMiddleware, vehicleController.getVehicleById)
    .put(authMiddleware, requireRole(['admin', 'manager', 'accountant', 'staff']), vehicleController.updateVehicle)
    .delete(authMiddleware, requireRole(['admin', 'manager']), vehicleController.deleteVehicle);

// Routes for vehicle maintenance records
router.route('/:id/maintenance')
    .get(authMiddleware, vehicleController.getMaintenanceForVehicle)
    .post(authMiddleware, requireRole(['admin', 'manager', 'accountant', 'staff']), vehicleController.addMaintenance);

module.exports = router;