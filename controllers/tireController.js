const db = require('../db/postgres');

/**
 * @desc    Get all tires
 * @route   GET /api/v1/tires
 */
exports.getAllTires = async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM tires ORDER BY purchase_date DESC');
        res.status(200).json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

/**
 * @desc    Get a single tire by ID
 * @route   GET /api/v1/tires/:id
 */
exports.getTireById = async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM tires WHERE tire_id = $1', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ msg: 'Tire not found' });
        }
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

/**
 * @desc    Add a new tire
 * @route   POST /api/v1/tires
 */
exports.addTire = async (req, res) => {
    const { serial_number, brand, sidewall, status, purchase_date } = req.body;
    const created_by_user_id = req.user.id;
    try {
        const query = `
            INSERT INTO tires (serial_number, brand, sidewall, status, purchase_date, created_by_user_id) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *
        `;
        const { rows } = await db.query(query, [serial_number, brand, sidewall, status, purchase_date, created_by_user_id]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

/**
 * @desc    Update a tire
 * @route   PUT /api/v1/tires/:id
 */
exports.updateTire = async (req, res) => {
    const { serial_number, brand, sidewall, status, purchase_date } = req.body;
    try {
        const query = `
            UPDATE tires 
            SET serial_number = $1, brand = $2, sidewall = $3, status = $4, purchase_date = $5 
            WHERE tire_id = $6 
            RETURNING *
        `;
        const { rows } = await db.query(query, [serial_number, brand, sidewall, status, purchase_date, req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ msg: 'Tire not found' });
        }
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

/**
 * @desc    Get all tire assignments
 * @route   GET /api/v1/tires/assignments
 */
exports.getAllAssignments = async (req, res) => {
    try {
        const query = `
            SELECT 
                ta.assignment_id, ta.mount_date, ta.unmount_date, ta.position,
                t.tire_id, t.serial_number, t.brand, t.sidewall,
                v.vehicle_id, v.vehicle_name, v.license_plate,
                u.username as recorded_by
            FROM tire_assignments ta
            JOIN tires t ON ta.tire_id = t.tire_id
            JOIN vehicles v ON ta.vehicle_id = v.vehicle_id
            LEFT JOIN users u ON ta.recorded_by_user_id = u.id
            ORDER BY ta.mount_date DESC
        `;
        const { rows } = await db.query(query);
        res.status(200).json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

/**
 * @desc    Assign a tire to a vehicle
 * @route   POST /api/v1/tires/assign
 */
exports.assignTire = async (req, res) => {
    const { tire_id, vehicle_id, position, mount_date } = req.body;
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        
        // 1. Create the new assignment record
        const assignQuery = `
            INSERT INTO tire_assignments (tire_id, vehicle_id, position, mount_date, recorded_by_user_id) 
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `;
        const { rows } = await client.query(assignQuery, [tire_id, vehicle_id, position, mount_date, req.user.id]);
        
        // 2. Update the tire's status to 'On Vehicle'
        await client.query("UPDATE tires SET status = 'On Vehicle' WHERE tire_id = $1", [tire_id]);
        
        await client.query('COMMIT');
        res.status(201).json(rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
};

/**
 * @desc    Unmount a tire from a vehicle
 * @route   PUT /api/v1/tires/unmount/:tireId
 */
exports.unmountTire = async (req, res) => {
    const { unmount_date, new_status } = req.body; // new_status could be 'In Stock' or 'Retired'
    const { tireId } = req.params;
    const client = await db.getClient();

    if (!new_status || !['In Stock', 'Retired'].includes(new_status)) {
        return res.status(400).json({ msg: "Invalid 'new_status' provided. Must be 'In Stock' or 'Retired'." });
    }

    try {
        await client.query('BEGIN');

        // 1. Find the latest active assignment for this tire and update it
        const updateAssignQuery = `
            UPDATE tire_assignments 
            SET unmount_date = $1 
            WHERE tire_id = $2 AND unmount_date IS NULL 
            RETURNING *
        `;
        const updatedAssignment = await client.query(updateAssignQuery, [unmount_date, tireId]);

        if (updatedAssignment.rows.length === 0) {
            throw new Error('No active assignment found for this tire.');
        }

        // 2. Update the tire's status
        await client.query('UPDATE tires SET status = $1 WHERE tire_id = $2', [new_status, tireId]);

        await client.query('COMMIT');
        res.status(200).json({ msg: 'Tire unmounted successfully', assignment: updatedAssignment.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
};
