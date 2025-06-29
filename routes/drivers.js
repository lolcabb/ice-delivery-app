// ice-delivery-app/routes/drivers.js
const express = require('express');
const router = express.Router();
const { query, getClient } = require('../db/postgres'); 
const { authMiddleware, requireRole } = require('../middleware/auth');

// --- Helper function for error handling ---
const handleError = (res, error, message = "An error occurred", statusCode = 500) => {
    console.error(message, error);
    const errorMessage = process.env.NODE_ENV === 'production' && statusCode === 500
        ? "An unexpected error occurred on the server."
        : `${message}: ${error.message || error}`;
    res.status(statusCode).json({ error: errorMessage });
};

// === DRIVER MANAGEMENT ENDPOINTS ===

// POST /api/drivers - Create a new driver
router.post('/', authMiddleware, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
    // Expect 'name' instead of 'first_name', 'last_name' will be nullified
    const { name, phone_number, license_plate, notes, is_active = true } = req.body;
    const created_by_user_id = req.user.id;

    console.log(`[Drivers API] POST / - User: ${created_by_user_id} attempting to create driver: ${name}`);

    if (!name || !name.trim()) { // Ensure name is not empty
        return res.status(400).json({ error: 'Driver name is required.' });
    }

    try {
        const sql = `
            INSERT INTO drivers 
            (first_name, last_name, phone_number, license_plate, is_active, notes, created_by_user_id, last_updated_by_user_id)
            VALUES ($1, NULL, $2, $3, $4, $5, $6, $6) -- Store full name in first_name, set last_name to NULL
            RETURNING driver_id, first_name, last_name, phone_number, license_plate, is_active, notes, created_at, updated_at, created_by_user_id, last_updated_by_user_id; 
        `;
        const values = [
            name.trim(), // Store the full name in the first_name column
            phone_number || null,
            license_plate || null,
            is_active,
            notes || null,
            created_by_user_id
        ];

        const result = await query(sql, values);
        // Return first_name as 'name' for consistency if desired by frontend, or frontend adapts
        const driver = result.rows[0];
        res.status(201).json({
            ...driver,
            name: driver.first_name // Add a 'name' field to the response for clarity
        });
    } catch (err) {
        handleError(res, err, "Failed to create driver");
    }
});

// GET /api/drivers - Fetch a list of drivers
router.get('/', authMiddleware, requireRole(['admin', 'manager', 'staff', 'accountant']), async (req, res) => {
    const { is_active, search } = req.query;
    const requesting_user_id = req.user.id;

    console.log(`[Drivers API] GET / - User: ${requesting_user_id} requesting drivers. Filters: is_active=${is_active}, search=${search}`);

    let sql = `
        SELECT driver_id, first_name, last_name, phone_number, license_plate, is_active, notes, created_at, updated_at, 
               uc.username AS created_by_username, uu.username AS last_updated_by_username
        FROM drivers d
        LEFT JOIN users uc ON d.created_by_user_id = uc.id
        LEFT JOIN users uu ON d.last_updated_by_user_id = uu.id
    `;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (is_active !== undefined && (is_active === 'true' || is_active === 'false')) {
        conditions.push(`d.is_active = $${paramIndex++}`);
        values.push(is_active === 'true');
    }

    if (search) {
        // Search in first_name (which now holds the full name)
        conditions.push(`(d.first_name ILIKE $${paramIndex} OR d.phone_number ILIKE $${paramIndex} OR d.license_plate ILIKE $${paramIndex})`);
        values.push(`%${search}%`);
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }
    // Display name will be first_name (full name)
    sql += " ORDER BY d.first_name ASC;";

    try {
        const result = await query(sql, values);
        // Add 'name' field to each driver for frontend consistency
        const driversWithFullName = result.rows.map(driver => ({
            ...driver,
            name: driver.first_name 
        }));
        res.json(driversWithFullName);
    } catch (err) {
        handleError(res, err, "Failed to retrieve drivers");
    }
});

// GET /api/drivers/:driverId - Fetch a single driver by ID
router.get('/:driverId', authMiddleware, requireRole(['admin', 'manager', 'staff', 'accountant']), async (req, res) => {
    const driverId = parseInt(req.params.driverId);
    const requesting_user_id = req.user.id;

    console.log(`[Drivers API] GET /${driverId} - User: ${requesting_user_id}`);

    if (isNaN(driverId)) {
        return res.status(400).json({ error: 'Invalid Driver ID.' });
    }

    try {
        const sql = `
            SELECT d.driver_id, d.first_name, d.last_name, d.phone_number, d.license_plate, d.is_active, d.notes, 
                   d.created_at, d.updated_at, 
                   uc.username AS created_by_username, uu.username AS last_updated_by_username
            FROM drivers d
            LEFT JOIN users uc ON d.created_by_user_id = uc.id
            LEFT JOIN users uu ON d.last_updated_by_user_id = uu.id
            WHERE d.driver_id = $1;
        `;
        const result = await query(sql, [driverId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found.' });
        }
        const driver = result.rows[0];
        res.json({
            ...driver,
            name: driver.first_name // Add 'name' for consistency
        });
    } catch (err) {
        handleError(res, err, "Failed to retrieve driver");
    }
});

// PUT /api/drivers/:driverId - Update an existing driver
router.put('/:driverId', authMiddleware, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
    const driverId = parseInt(req.params.driverId);
    // Expect 'name' instead of 'first_name'
    const { name, phone_number, license_plate, notes, is_active } = req.body;
    const last_updated_by_user_id = req.user.id;

    console.log(`[Drivers API] PUT /${driverId} - User: ${last_updated_by_user_id} attempting to update.`);

    if (isNaN(driverId)) {
        return res.status(400).json({ error: 'Invalid Driver ID.' });
    }
    if (name === undefined && phone_number === undefined && license_plate === undefined && notes === undefined && is_active === undefined) {
        return res.status(400).json({ error: 'At least one field to update must be provided.' });
    }
    if (name !== undefined && !name.trim()) {
         return res.status(400).json({ error: 'Name cannot be empty if provided for update.' });
    }

    const fieldsToUpdate = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { 
        fieldsToUpdate.push(`first_name = $${paramIndex++}`); // Store 'name' in 'first_name' column
        values.push(name.trim()); 
        fieldsToUpdate.push(`last_name = NULL`); // Nullify last_name
    }
    if (phone_number !== undefined) { fieldsToUpdate.push(`phone_number = $${paramIndex++}`); values.push(phone_number || null); }
    if (license_plate !== undefined) { fieldsToUpdate.push(`license_plate = $${paramIndex++}`); values.push(license_plate || null); }
    if (notes !== undefined) { fieldsToUpdate.push(`notes = $${paramIndex++}`); values.push(notes || null); }
    if (is_active !== undefined) { fieldsToUpdate.push(`is_active = $${paramIndex++}`); values.push(Boolean(is_active)); }
    
    fieldsToUpdate.push(`last_updated_by_user_id = $${paramIndex++}`);
    values.push(last_updated_by_user_id);
    fieldsToUpdate.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(driverId); 

    try {
        const sql = `
            UPDATE drivers 
            SET ${fieldsToUpdate.join(', ')}
            WHERE driver_id = $${paramIndex}
            RETURNING driver_id, first_name, last_name, phone_number, license_plate, is_active, notes, created_at, updated_at, created_by_user_id, last_updated_by_user_id;
        `;
        
        const result = await query(sql, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found for update.' });
        }
        const driver = result.rows[0];
        res.json({
            ...driver,
            name: driver.first_name // Add 'name' for consistency
        });
    } catch (err) {
        handleError(res, err, "Failed to update driver");
    }
});

// DELETE /api/drivers/:driverId - Soft delete a driver
router.delete('/:driverId', authMiddleware, requireRole(['admin', 'manager']), async (req, res) => {
    const driverId = parseInt(req.params.driverId);
    const last_updated_by_user_id = req.user.id;

    console.log(`[Drivers API] DELETE /${driverId} - User: ${last_updated_by_user_id} attempting to deactivate.`);

    if (isNaN(driverId)) {
        return res.status(400).json({ error: 'Invalid Driver ID.' });
    }

    try {
        const sql = `
            UPDATE drivers
            SET is_active = FALSE, last_updated_by_user_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE driver_id = $2
            RETURNING driver_id, first_name, last_name, is_active;
        `;
        const values = [last_updated_by_user_id, driverId];
        const result = await query(sql, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found.' });
        }
        const driver = result.rows[0];
        res.json({ 
            message: 'Driver deactivated successfully.', 
            driver: { ...driver, name: driver.first_name }
        });
    } catch (err) {
        handleError(res, err, "Failed to deactivate driver");
    }
});


module.exports = router;
