const pool = require('../db/postgres');

/**
 * @desc    Get all vehicles
 * @route   GET /api/v1/vehicles
 */
exports.getAllVehles = async (req, res) => {
    try {
        const query = 'SELECT vehicle_id, vehicle_name, license_plate, vehicle_type, make, model, year, status FROM vehicles ORDER BY vehicle_name ASC';
        const { rows } = await pool.query(query);
        res.status(200).json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

/**
 * @desc    Get a single vehicle by ID
 * @route   GET /api/v1/vehicles/:id
 */
exports.getVehicleById = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM vehicles WHERE vehicle_id = $1', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ msg: 'Vehicle not found' });
        }
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

/**
 * @desc    Add a new vehicle
 * @route   POST /api/v1/vehicles
 */
exports.addVehicle = async (req, res) => {
    const { vehicle_name, license_plate, vehicle_type, make, model, year, status } = req.body;
    const created_by_user_id = req.user.id; // From authMiddleware

    try {
        const query = `
            INSERT INTO vehicles (vehicle_name, license_plate, vehicle_type, make, model, year, status, created_by_user_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING *
        `;
        const { rows } = await pool.query(query, [vehicle_name, license_plate, vehicle_type, make, model, year, status, created_by_user_id]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

/**
 * @desc    Update a vehicle
 * @route   PUT /api/v1/vehicles/:id
 */
exports.updateVehicle = async (req, res) => {
    const { vehicle_name, license_plate, vehicle_type, make, model, year, status } = req.body;
    try {
        const query = `
            UPDATE vehicles 
            SET vehicle_name = $1, license_plate = $2, vehicle_type = $3, make = $4, model = $5, year = $6, status = $7, updated_at = NOW() 
            WHERE vehicle_id = $8 
            RETURNING *
        `;
        const { rows } = await pool.query(query, [vehicle_name, license_plate, vehicle_type, make, model, year, status, req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ msg: 'Vehicle not found' });
        }
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

/**
 * @desc    Delete a vehicle
 * @route   DELETE /api/v1/vehicles/:id
 */
exports.deleteVehicle = async (req, res) => {
    try {
        // Note: You may want to handle related records (maintenance, tire assignments) before deleting.
        // For now, this performs a direct deletion.
        const deleteOp = await pool.query('DELETE FROM vehicles WHERE vehicle_id = $1', [req.params.id]);
        if (deleteOp.rowCount === 0) {
            return res.status(404).json({ msg: 'Vehicle not found' });
        }
        res.status(200).json({ msg: 'Vehicle removed' });
    } catch (err) {
        console.error(err.message);
        // Handle foreign key constraint errors if a vehicle has related records
        if (err.code === '23503') {
            return res.status(400).json({ msg: 'Cannot delete vehicle. It has related maintenance or tire records.' });
        }
        res.status(500).send('Server error');
    }
};

/**
 * @desc    Get all maintenance records for a specific vehicle
 * @route   GET /api/v1/vehicles/:id/maintenance
 */
exports.getMaintenanceForVehicle = async (req, res) => {
    try {
        const query = `
            SELECT vm.*, u.username as recorded_by
            FROM vehicle_maintenance vm
            LEFT JOIN users u ON vm.recorded_by_user_id = u.id
            WHERE vm.vehicle_id = $1 
            ORDER BY vm.maintenance_date DESC
        `;
        const { rows } = await pool.query(query, [req.params.id]);
        res.status(200).json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

/**
 * @desc    Add a maintenance record for a vehicle
 * @route   POST /api/v1/vehicles/:id/maintenance
 */
exports.addMaintenance = async (req, res) => {
    const { maintenance_date, description, cost, next_maintenance_due } = req.body;
    const recorded_by_user_id = req.user.id;
    const vehicle_id = req.params.id;

    try {
        const query = `
            INSERT INTO vehicle_maintenance (vehicle_id, maintenance_date, description, cost, next_maintenance_due, recorded_by_user_id) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *
        `;
        const { rows } = await pool.query(query, [vehicle_id, maintenance_date, description, cost, next_maintenance_due, recorded_by_user_id]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
