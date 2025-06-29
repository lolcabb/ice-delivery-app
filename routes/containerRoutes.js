// ice-delivery-app/routes/containerRoutes.js
const express = require('express');
const router = express.Router();
const { query, getClient } = require('../db/postgres'); 
const { authMiddleware, requireRole } = require('../middleware/auth'); 

// --- Helper function for error handling ---
const handleError = (res, error, message = "An error occurred", statusCode = 500) => {
    console.error(message, error);
    const errorMessage = process.env.NODE_ENV === 'production' ? message : `${message}: ${error.message || error}`;
    res.status(statusCode).json({ error: errorMessage });
};

// === ICE CONTAINER SIZES ===
// Base path: /api/containers/sizes
router.get('/sizes', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => {
    try {
        const result = await query('SELECT * FROM ice_container_sizes WHERE is_active = TRUE ORDER BY capacity_liters ASC');
        res.json(result.rows);
    } catch (err) { handleError(res, err, "Failed to retrieve ice container sizes"); }
});
router.post('/sizes', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res) => {
    const { size_code, description, capacity_liters } = req.body;
    if (!size_code || capacity_liters === undefined) return res.status(400).json({ error: 'Size code and capacity (liters) are required.' });
    if (isNaN(parseInt(capacity_liters)) || parseInt(capacity_liters) <= 0) return res.status(400).json({ error: 'Capacity must be a positive number.' });
    try {
        const result = await query('INSERT INTO ice_container_sizes (size_code, description, capacity_liters) VALUES ($1, $2, $3) RETURNING *', [size_code, description, parseInt(capacity_liters)]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return handleError(res, err, `Container size code '${size_code}' already exists.`, 409);
        handleError(res, err, "Failed to create ice container size");
    }
});
router.put('/sizes/:id', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res) => {
    const sizeId = parseInt(req.params.id);
    const { size_code, description, capacity_liters, is_active } = req.body;
    if (isNaN(sizeId)) return res.status(400).json({ error: 'Invalid size ID.' });
    if (!size_code || capacity_liters === undefined) return res.status(400).json({ error: 'Size code and capacity (liters) are required.' });
    if (isNaN(parseInt(capacity_liters)) || parseInt(capacity_liters) <= 0) return res.status(400).json({ error: 'Capacity must be a positive number.' });
    try {
        const result = await query('UPDATE ice_container_sizes SET size_code = $1, description = $2, capacity_liters = $3, is_active = $4, updated_at = NOW() WHERE size_id = $5 RETURNING *', [size_code, description, parseInt(capacity_liters), is_active === undefined ? true : is_active, sizeId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Ice container size not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return handleError(res, err, `Container size code '${size_code}' already exists.`, 409);
        handleError(res, err, "Failed to update ice container size");
    }
});
router.delete('/sizes/:id', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res) => { 
    const sizeId = parseInt(req.params.id);
    if (isNaN(sizeId)) return res.status(400).json({ error: 'Invalid size ID.' });
    try {
        const containersCheck = await query('SELECT 1 FROM ice_containers WHERE size_id = $1 LIMIT 1', [sizeId]);
        if (containersCheck.rows.length > 0) return res.status(400).json({ error: 'Cannot deactivate size. It is currently in use by containers. Please reassign containers first.' });
        const result = await query('UPDATE ice_container_sizes SET is_active = FALSE, updated_at = NOW() WHERE size_id = $1 RETURNING *', [sizeId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Ice container size not found.' });
        res.json({ message: 'Ice container size deactivated successfully.', size: result.rows[0] });
    } catch (err) { handleError(res, err, "Failed to deactivate ice container size"); }
});

// === RETURN REASONS ===
// Base path: /api/containers/return-reasons
router.get('/return-reasons', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => { 
    try {
        const result = await query('SELECT * FROM return_reasons WHERE is_active = TRUE ORDER BY reason_description ASC');
        res.json(result.rows);
    } catch (err) { handleError(res, err, "Failed to retrieve return reasons"); }
});
router.post('/return-reasons', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => {
    const { reason_description } = req.body;
    if (!reason_description) return res.status(400).json({ error: 'Reason description is required.' });
    try {
        const result = await query('INSERT INTO return_reasons (reason_description) VALUES ($1) RETURNING *', [reason_description]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return handleError(res, err, `Return reason '${reason_description}' already exists.`, 409);
        handleError(res, err, "Failed to create return reason");
    }
});
router.put('/return-reasons/:id', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => {
    const reasonId = parseInt(req.params.id);
    const { reason_description, is_active } = req.body;
    if (isNaN(reasonId)) return res.status(400).json({ error: 'Invalid reason ID.' });
    if (!reason_description) return res.status(400).json({ error: 'Reason description is required.' });
    try {
        const result = await query('UPDATE return_reasons SET reason_description = $1, is_active = $2, updated_at = NOW() WHERE return_reason_id = $3 RETURNING *', [reason_description, is_active === undefined ? true : is_active, reasonId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Return reason not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return handleError(res, err, `Return reason '${reason_description}' already exists.`, 409);
        handleError(res, err, "Failed to update return reason");
    }
});
router.delete('/return-reasons/:id', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => {
    const reasonId = parseInt(req.params.id);
    if (isNaN(reasonId)) return res.status(400).json({ error: 'Invalid reason ID.' });
    try {
        const assignmentsCheck = await query('SELECT 1 FROM ice_container_assignments WHERE return_reason_id = $1 LIMIT 1', [reasonId]);
        if (assignmentsCheck.rows.length > 0) return res.status(400).json({ error: 'Cannot deactivate reason. It is currently in use. Consider creating a new reason if changes are needed.' });
        const result = await query('UPDATE return_reasons SET is_active = FALSE, updated_at = NOW() WHERE return_reason_id = $1 RETURNING *', [reasonId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Return reason not found.' });
        res.json({ message: 'Return reason deactivated successfully.', reason: result.rows[0] });
    } catch (err) { handleError(res, err, "Failed to deactivate return reason"); }
});


// === ICE CONTAINERS (Serialized Items) ===
// Base path: /api/containers/items

// POST a new ice container
router.post('/items', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => { 
    const { 
        serial_number, size_id, container_type, 
        status = 'In Stock', purchase_date, notes 
    } = req.body;
    const user_id_created_by = req.user.id;

    if (!serial_number || !size_id || !container_type) { // Removed item_type_id from check
        return res.status(400).json({ error: 'Serial number, size, and container type are required.' });
    }
    try {
        const result = await query(
            `INSERT INTO ice_containers 
             (serial_number, size_id, container_type, status, purchase_date, notes, user_id_created_by, user_id_last_updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *`, // Removed item_type_id, adjusted params
            [serial_number, parseInt(size_id), container_type, status, purchase_date || null, notes, user_id_created_by]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505' && err.constraint === 'ice_containers_serial_number_key') {
            return handleError(res, err, `Serial number '${serial_number}' already exists.`, 409);
        }
        if (err.code === '23503') { // Foreign key violation (e.g. for size_id)
            return handleError(res, err, 'Invalid size_id provided.', 400);
        }
        handleError(res, err, "Failed to create ice container");
    }
});

// GET all ice containers (with filtering and pagination)
router.get('/items', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => {
    const { page = 1, limit = 20, serial_number, size_id, container_type, status, customer_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let mainQuery = `
        SELECT
            c.*,
            cs.size_code,
            cs.capacity_liters,
            cs.description AS size_description,
            CASE
                WHEN c.status = 'With Customer' THEN cust.customer_name
                ELSE NULL
            END as current_customer_name_display
        FROM ice_containers c
        LEFT JOIN ice_container_sizes cs ON c.size_id = cs.size_id
        LEFT JOIN customers cust ON c.current_customer_id = cust.customer_id
    `;
    // The countQuery does not need to select individual columns,
    // so no change is needed here regarding size_description.
    let countQuery = `
        SELECT COUNT(c.*)
        FROM ice_containers c
        LEFT JOIN ice_container_sizes cs ON c.size_id = cs.size_id
        LEFT JOIN customers cust ON c.current_customer_id = cust.customer_id
    `;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (serial_number) { conditions.push(`c.serial_number ILIKE $${paramIndex++}`); values.push(`%${serial_number}%`); }
    if (size_id) { conditions.push(`c.size_id = $${paramIndex++}`); values.push(parseInt(size_id)); }
    if (container_type) { conditions.push(`c.container_type = $${paramIndex++}`); values.push(container_type); }
    if (status) { conditions.push(`c.status = $${paramIndex++}`); values.push(status); }
    if (customer_id) { conditions.push(`c.current_customer_id = $${paramIndex++}`); values.push(parseInt(customer_id)); }

    if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        mainQuery += whereClause;
        countQuery += whereClause;
    }

    mainQuery += ` ORDER BY c.serial_number ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const mainQueryValues = [...values, parseInt(limit), parseInt(offset)];

    try {
        const result = await query(mainQuery, mainQueryValues);
        const countResult = await query(countQuery, values);

        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / parseInt(limit));

        res.json({
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalItems,
                totalPages
            }
        });
    } catch (err) {
        handleError(res, err, "Failed to retrieve ice containers");
    }
});

// GET a single ice container by ID
router.get('/items/:id', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => { 
    const containerId = parseInt(req.params.id);
    if (isNaN(containerId)) return res.status(400).json({ error: 'Invalid container ID.' });
    try {
        const result = await query(
            `SELECT ic.*, sz.size_code, sz.description as size_description, sz.capacity_liters,
                    cust.customer_name as current_customer_name_display, -- Fetch customer name
                    asg.assignment_id as current_assignment_id_details, asg.assigned_date as current_assignment_date
             FROM ice_containers ic
             JOIN ice_container_sizes sz ON ic.size_id = sz.size_id
             LEFT JOIN customers cust ON ic.current_customer_id = cust.customer_id -- Join to get customer name
             LEFT JOIN ice_container_assignments asg ON ic.current_assignment_id = asg.assignment_id
             WHERE ic.container_id = $1`,
            [containerId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Ice container not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        handleError(res, err, "Failed to retrieve ice container");
    }
});

// PUT (update) an existing ice container
router.put('/items/:id', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => {
    const containerId = parseInt(req.params.id);
    const { 
        serial_number, size_id, container_type, 
        status, purchase_date, notes,
        current_customer_id, // Expecting customer_id now
        current_assignment_id 
    } = req.body;
    const user_id_last_updated_by = req.user.id;

    if (isNaN(containerId)) return res.status(400).json({ error: 'Invalid container ID.' });
    if (!serial_number || !size_id || !container_type || !status) { 
        return res.status(400).json({ error: 'Serial number, size, container type, and status are required.' });
    }
    if (current_customer_id !== undefined && current_customer_id !== null && isNaN(parseInt(current_customer_id))) {
        return res.status(400).json({ error: 'Invalid current_customer_id format.' });
    }

    try {
        const result = await query(
            `UPDATE ice_containers 
             SET serial_number = $1, size_id = $2, container_type = $3, status = $4, 
                 purchase_date = $5, notes = $6, user_id_last_updated_by = $7, updated_at = NOW(),
                 current_customer_id = $8, current_assignment_id = $9 
             WHERE container_id = $10 RETURNING *`, 
            [
                serial_number, parseInt(size_id), container_type, status,
                purchase_date || null, notes, user_id_last_updated_by,
                current_customer_id ? parseInt(current_customer_id) : null, // Use customer_id
                current_assignment_id ? parseInt(current_assignment_id) : null,
                containerId
            ]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Ice container not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505' && err.constraint === 'ice_containers_serial_number_key') {
            return handleError(res, err, `Serial number '${serial_number}' already exists for another container.`, 409);
        }
        if (err.code === '23503') { 
            return handleError(res, err, 'Invalid size_id, current_customer_id, or current_assignment_id provided.', 400);
        }
        handleError(res, err, "Failed to update ice container");
    }
});

// DELETE (soft delete by setting status to 'Retired') an ice container
router.delete('/items/:id', authMiddleware, requireRole(['admin', 'accountant']), async (req, res) => { 
    const containerId = parseInt(req.params.id);
    const user_id_last_updated_by = req.user.id;
    if (isNaN(containerId)) return res.status(400).json({ error: 'Invalid container ID.' });
    try {
        const containerCheck = await query('SELECT status, current_customer_id FROM ice_containers WHERE container_id = $1', [containerId]);
        if (containerCheck.rows.length === 0) return res.status(404).json({ error: 'Ice container not found.' });
        if (containerCheck.rows[0].status === 'With Customer') {
             // Fetch customer name for better error message
            let customerName = 'a customer';
            if(containerCheck.rows[0].current_customer_id) {
                const custNameResult = await query('SELECT customer_name FROM customers WHERE customer_id = $1', [containerCheck.rows[0].current_customer_id]);
                if(custNameResult.rows.length > 0) customerName = custNameResult.rows[0].customer_name;
            }
            return res.status(400).json({ error: `Cannot retire container. It is currently assigned to ${customerName}. Please ensure it's returned first.` });
        }
        const result = await query( `UPDATE ice_containers SET status = 'Retired', user_id_last_updated_by = $1, updated_at = NOW(), current_customer_id = NULL, current_assignment_id = NULL WHERE container_id = $2 RETURNING *`, [user_id_last_updated_by, containerId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Ice container not found during update to retired.' });
        res.json({ message: 'Ice container retired successfully.', container: result.rows[0] });
    } catch (err) { handleError(res, err, "Failed to retire ice container"); }
});


// === ICE CONTAINER ASSIGNMENTS ===
// POST: Assign a container to a customer
router.post('/items/:containerId/assign', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => {
    const containerId = parseInt(req.params.containerId);
    const { customer_id, assigned_date, notes, expected_return_date } = req.body; // Expecting customer_id now
    const user_id = req.user.id;

    if (isNaN(containerId)) return res.status(400).json({ error: 'Invalid container ID.' });
    if (!customer_id || isNaN(parseInt(customer_id))) return res.status(400).json({ error: 'Valid Customer ID is required for assignment.' });
    if (!assigned_date) return res.status(400).json({ error: 'Assigned date is required.' });

    // Optional: Validate expected_return_date if provided
    if (expected_return_date && !/^\d{4}-\d{2}-\d{2}$/.test(expected_return_date)) {
        return res.status(400).json({ error: 'Invalid expected_return_date format. Use YYYY-MM-DD.' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');
        const containerResult = await client.query('SELECT status FROM ice_containers WHERE container_id = $1 FOR UPDATE', [containerId]);
        if (containerResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Container not found.' }); }
        if (containerResult.rows[0].status !== 'In Stock') { await client.query('ROLLBACK'); return res.status(400).json({ error: `Container is not available for assignment. Current status: ${containerResult.rows[0].status}` }); }
        
        // Optional: Fetch customer_name for denormalization if you were still storing it on ice_containers.
        // Since we changed ice_containers to store current_customer_id, we just pass the ID.
        
        const assignmentResult = await client.query(
            `INSERT INTO ice_container_assignments (container_id, customer_id, assigned_date, notes, user_id, expected_return_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, 
            [containerId, parseInt(customer_id), assigned_date, notes, user_id, expected_return_date || null]
        );
        const newAssignment = assignmentResult.rows[0];

        await client.query(
            `UPDATE ice_containers SET status = 'With Customer', current_customer_id = $1, current_assignment_id = $2, user_id_last_updated_by = $3, updated_at = NOW() WHERE container_id = $4`,
            [parseInt(customer_id), newAssignment.assignment_id, user_id, containerId]
        );
        await client.query('COMMIT');
        
        // Fetch full assignment details with customer name for the response
        const fullAssignment = await query(
            `SELECT a.*, c.serial_number, cust.customer_name 
             FROM ice_container_assignments a 
             JOIN ice_containers c ON a.container_id = c.container_id 
             JOIN customers cust ON a.customer_id = cust.customer_id
             WHERE a.assignment_id = $1`, [newAssignment.assignment_id]
        );
        res.status(201).json(fullAssignment.rows[0]);

    } catch (err) { 
        await client.query('ROLLBACK'); 
        if (err.code === '23503') { // Foreign key violation
            if (err.constraint === 'ice_container_assignments_customer_id_fkey') {
                 return handleError(res, err, 'Invalid customer_id provided for assignment.', 400);
            }
        }
        handleError(res, err, "Failed to assign container");
    } finally { client.release(); }
});

// PUT: Update specific details of an existing assignment
router.put('/assignments/:assignmentId', authMiddleware, requireRole(['admin', 'manager', 'accountant', 'staff']), async (req, res) => {
    const assignmentId = parseInt(req.params.assignmentId, 10);
    // These are the fields we'll allow editing for an assignment via this route
    const { assigned_date, notes, expected_return_date } = req.body;
    const user_id = req.user.id; // User performing the update

    if (isNaN(assignmentId)) {
        return res.status(400).json({ error: 'Invalid assignment ID.' });
    }

    // --- Input Validation ---
    let hasUpdateFields = false;
    if (assigned_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(assigned_date)) {
        return res.status(400).json({ error: 'Invalid assigned_date format. Use YYYY-MM-DD.' });
    }
    if (expected_return_date !== undefined && expected_return_date !== null && expected_return_date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(expected_return_date)) {
        return res.status(400).json({ error: 'Invalid expected_return_date format. Use YYYY-MM-DD or leave empty/null.' });
    }
    if (notes !== undefined && typeof notes !== 'string' && notes !== null) { // Allow null for notes
        return res.status(400).json({ error: 'Invalid notes format, must be a string or null.' });
    }
    if (assigned_date && expected_return_date && expected_return_date < assigned_date) {
        return res.status(400).json({ error: 'Expected return date cannot be before the assigned date.' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        // Check if assignment exists and is not yet returned (important!)
        const assignmentCheckResult = await client.query(
            'SELECT returned_date FROM ice_container_assignments WHERE assignment_id = $1 FOR UPDATE',
            [assignmentId]
        );

        if (assignmentCheckResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Assignment record not found.' });
        }
        if (assignmentCheckResult.rows[0].returned_date !== null) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Cannot edit an assignment that has already been marked as returned.' });
        }

        // --- Build SQL Update Query ---
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (assigned_date !== undefined) {
            updates.push(`assigned_date = $${paramIndex++}`);
            values.push(assigned_date);
            hasUpdateFields = true;
        }
        if (notes !== undefined) {
            updates.push(`notes = $${paramIndex++}`);
            if (typeof notes === 'string') {
                values.push(notes.trim() === '' ? null : notes.trim());
            } else { // Handles if notes is explicitly null
                values.push(null);
            }
            hasUpdateFields = true;
        }
        if (expected_return_date !== undefined) {
            updates.push(`expected_return_date = $${paramIndex++}`);
            values.push(expected_return_date === '' ? null : expected_return_date); // Store empty date as null
            hasUpdateFields = true;
        }
        
        if (!hasUpdateFields) {
            await client.query('ROLLBACK');
            // Return a 200 or 304 if no actual changes, or 400 if they must provide something.
            // For simplicity, let's treat it as if no valid fields were provided for an update intent.
            return res.status(400).json({ error: 'No valid fields provided for update. Provide assigned_date, notes, or expected_return_date.' });
        }

        // Always update updated_at and user_id (who last modified it)
        updates.push(`updated_at = NOW()`);
        updates.push(`user_id = $${paramIndex++}`);
        values.push(user_id);

        values.push(assignmentId); // For the WHERE clause (this will be the last parameter)

        const updateQueryString = `UPDATE ice_container_assignments SET ${updates.join(', ')} WHERE assignment_id = $${paramIndex} RETURNING *`;
        
        console.log("Executing Assignment Update Query:", updateQueryString);
        console.log("Values:", values);
        
        const result = await client.query(updateQueryString, values);

        if (result.rows.length === 0) {
            // This case should ideally be caught by the initial check, but as a safeguard:
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Assignment not found during update attempt.' });
        }

        await client.query('COMMIT');
        
        // Fetch full assignment details with customer name for the response, similar to assign route
        const fullUpdatedAssignment = await query(
             `SELECT a.*, c.serial_number, cust.customer_name, sz.size_code as container_size_code, rr.reason_description as return_reason_text, updated_by_user.username as processed_by_username 
              FROM ice_container_assignments a 
              JOIN ice_containers c ON a.container_id = c.container_id 
              JOIN customers cust ON a.customer_id = cust.customer_id
              JOIN ice_container_sizes sz ON c.size_id = sz.size_id
              LEFT JOIN return_reasons rr ON a.return_reason_id = rr.return_reason_id
              LEFT JOIN users updated_by_user ON a.user_id = updated_by_user.id
              WHERE a.assignment_id = $1`, 
              [result.rows[0].assignment_id]
        );

        res.json(fullUpdatedAssignment.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, "Failed to update assignment details");
    } finally {
        client.release();
    }
});

// PUT: Mark a container as returned (updates an assignment)
router.put('/assignments/:assignmentId/return', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => {
    const assignmentId = parseInt(req.params.assignmentId);
    const { returned_date, return_reason_id, custom_return_reason, notes: return_notes, new_container_status = 'In Stock' } = req.body;
    const user_id = req.user.id;

    if (isNaN(assignmentId)) return res.status(400).json({ error: 'Invalid assignment ID.' });
    if (!returned_date) return res.status(400).json({ error: 'Returned date is required.' });
    if (!['In Stock', 'Damaged', 'Maintenance'].includes(new_container_status)) {
        return res.status(400).json({ error: 'Invalid new container status. Must be In Stock, Damaged, or Maintenance.' });
    }
    if (return_reason_id && custom_return_reason) return res.status(400).json({ error: 'Provide either a predefined return reason or a custom reason, not both.' });
    if (!return_reason_id && !custom_return_reason) return res.status(400).json({ error: 'A return reason (predefined or custom) is required.' });

    const client = await getClient();
    try {
        await client.query('BEGIN');
        const assignmentCheck = await client.query('SELECT container_id, returned_date FROM ice_container_assignments WHERE assignment_id = $1 FOR UPDATE', [assignmentId]);
        if (assignmentCheck.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Assignment record not found.' }); }
        if (assignmentCheck.rows[0].returned_date !== null) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'This container assignment has already been marked as returned.' }); }
        const containerId = assignmentCheck.rows[0].container_id;

        const updatedAssignmentResult = await client.query(
            `UPDATE ice_container_assignments SET returned_date = $1, return_reason_id = $2, custom_return_reason = $3, notes = $4, user_id = $5, updated_at = NOW() WHERE assignment_id = $6 RETURNING *`,
            [returned_date, return_reason_id ? parseInt(return_reason_id) : null, custom_return_reason, return_notes, user_id, assignmentId]
        );
        await client.query( // Clear current_customer_id from ice_containers table
            `UPDATE ice_containers SET status = $1, current_customer_id = NULL, current_assignment_id = NULL, user_id_last_updated_by = $2, updated_at = NOW() WHERE container_id = $3`,
            [new_container_status, user_id, containerId]
        );
        await client.query('COMMIT');
        res.json(updatedAssignmentResult.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23503' && err.constraint === 'ice_container_assignments_return_reason_id_fkey') return handleError(res, err, "Invalid return_reason_id provided.", 400);
        handleError(res, err, "Failed to process container return");
    } finally { client.release(); }
});

// GET assignment history for a specific container
router.get('/items/:containerId/assignments', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => {
    const containerId = parseInt(req.params.containerId);
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    if (isNaN(containerId)) return res.status(400).json({ error: 'Invalid container ID.' });
    const mainQuery = `
        SELECT a.*, cust.customer_name, rr.reason_description as return_reason_text, u.username as processed_by_username 
        FROM ice_container_assignments a 
        JOIN customers cust ON a.customer_id = cust.customer_id
        LEFT JOIN return_reasons rr ON a.return_reason_id = rr.return_reason_id 
        LEFT JOIN users u ON a.user_id = u.id 
        WHERE a.container_id = $1 ORDER BY a.assigned_date DESC, a.created_at DESC LIMIT $2 OFFSET $3`;
    const countQuery = 'SELECT COUNT(*) FROM ice_container_assignments WHERE container_id = $1';
    try {
        const result = await query(mainQuery, [containerId, parseInt(limit), parseInt(offset)]);
        const countResult = await query(countQuery, [containerId]);
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / parseInt(limit));
        res.json({ data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), totalItems, totalPages } });
    } catch (err) { handleError(res, err, "Failed to retrieve container assignment history"); }
});

// GET all assignments (with filters and pagination)
router.get('/assignments', authMiddleware, requireRole(['admin', 'accountant', 'manager', 'staff']), async (req, res) => {
    const { page = 1, limit = 20, customer_id, customer_name_search, container_id, serial_number, assigned_date_start, assigned_date_end, returned_status, expected_return_date_start, expected_return_date_end } = req.query; // Added customer_id and customer_name_search
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let mainQuery = `SELECT a.*, ic.serial_number, ic.container_type, sz.size_code as container_size_code, cust.customer_name, rr.reason_description as return_reason_text, u.username as processed_by_username FROM ice_container_assignments a JOIN ice_containers ic ON a.container_id = ic.container_id JOIN ice_container_sizes sz ON ic.size_id = sz.size_id JOIN customers cust ON a.customer_id = cust.customer_id LEFT JOIN return_reasons rr ON a.return_reason_id = rr.return_reason_id LEFT JOIN users u ON a.user_id = u.id`;
    let countQuery = `SELECT COUNT(a.*) FROM ice_container_assignments a JOIN ice_containers ic ON a.container_id = ic.container_id JOIN ice_container_sizes sz ON ic.size_id = sz.size_id JOIN customers cust ON a.customer_id = cust.customer_id`;
    const conditions = []; const values = []; let paramIndex = 1;
    
    if (customer_id) { conditions.push(`a.customer_id = $${paramIndex++}`); values.push(parseInt(customer_id)); }
    else if (customer_name_search) { conditions.push(`cust.customer_name ILIKE $${paramIndex++}`); values.push(`%${customer_name_search}%`); } // Search by name if ID not provided
    
    if (container_id) { conditions.push(`a.container_id = $${paramIndex++}`); values.push(parseInt(container_id)); }
    if (serial_number) { conditions.push(`ic.serial_number ILIKE $${paramIndex++}`); values.push(`%${serial_number}%`); }
    if (assigned_date_start) { conditions.push(`a.assigned_date >= $${paramIndex++}`); values.push(assigned_date_start); }
    if (assigned_date_end) { conditions.push(`a.assigned_date <= $${paramIndex++}`); values.push(assigned_date_end); }

    if (expected_return_date_start) { conditions.push(`a.expected_return_date >= $${paramIndex++}`); values.push(expected_return_date_start); }
    if (expected_return_date_end) { conditions.push(`a.expected_return_date <= $${paramIndex++}`); values.push(expected_return_date_end); }

    if (returned_status === 'returned') { conditions.push(`a.returned_date IS NOT NULL`); }
    if (returned_status === 'not_returned') { conditions.push(`a.returned_date IS NULL`); }

    if (conditions.length > 0) { const whereClause = ' WHERE ' + conditions.join(' AND '); mainQuery += whereClause; countQuery += whereClause; }

    mainQuery += ` ORDER BY a.assigned_date DESC, a.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const mainQueryValues = [...values, parseInt(limit), parseInt(offset)];

    const countQueryValues = [...values]; // Use the same values for count query
    try {
        // Log queries and parameters for debugging
        console.log("Executing Main Query:", mainQuery);
        console.log("Main Query Values:", mainQueryValues);
        console.log("Executing Count Query:", countQuery);
        console.log("Count Query Values:", countQueryValues);

        // Execute both queries
        const result = await query(mainQuery, mainQueryValues);
        const countResult = await query(countQuery, countQueryValues);
        
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / parseInt(limit));
        res.json({ data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), totalItems, totalPages } });
    } catch (err) { handleError(res, err, "Failed to retrieve assignments"); }
});

module.exports = router;
