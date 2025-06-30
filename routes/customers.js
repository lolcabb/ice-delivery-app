// ice-delivery-app/routes/customers.js
const express = require('express');
const router = express.Router();
const { query, getClient } = require('../db/postgres'); 
const { authMiddleware, requireRole } = require('../middleware/auth');
const { GCS_BUCKET_NAME } = require('../config');

const { Storage } = require('@google-cloud/storage');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid'); // You might need to install uuid: npm install uuid

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB file size limit
});

// --- Initialize Google Cloud Storage ---
// This will automatically use the GOOGLE_APPLICATION_CREDENTIALS environment variable
const gcs = new Storage();
const bucket = gcs.bucket(GCS_BUCKET_NAME);

// --- Helper function for error handling ---
const handleError = (res, error, message = "An error occurred", statusCode = 500) => {
    console.error(message, error);
    const errorMessage = process.env.NODE_ENV === 'production' ? message : `${message}: ${error.message || error}`;
    res.status(statusCode).json({ error: errorMessage });
};

// --- Helper function for upload and optimization ---
const uploadToGCS = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            return resolve(null);
        }

        // Create a unique filename
        const fileName = `${Date.now()}-${uuidv4()}.jpeg`;
        const blob = bucket.file(fileName);
        const blobStream = blob.createWriteStream({
            resumable: false,
            contentType: 'image/jpeg'
        });

        blobStream.on('error', (err) => reject(err));

        blobStream.on('finish', () => {
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
            console.log(`Successfully uploaded to GCS: ${publicUrl}`);
            resolve(publicUrl);
        });

        // --- Image Optimization with Sharp ---
        sharp(file.buffer)
            .resize({ width: 800, withoutEnlargement: true }) // Resize to max 800px width, don't enlarge smaller images
            .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality
            .toBuffer()
            .then(processedBuffer => {
                blobStream.end(processedBuffer);
            })
            .catch(err => {
                reject(err);
            });
    });
};

// Simplified API routes for customer-route management
// GET customers for a specific route
router.get('/routes/:route_id/customers', authMiddleware, async (req, res) => {
    const route_id = parseInt(req.params.route_id);
    
    if (isNaN(route_id)) {
        return res.status(400).json({ error: 'Invalid route ID' });
    }

    try {
        const sql = `SELECT * FROM get_route_customers_for_sales($1)`;
        const result = await query(sql, [route_id]);
        
        res.json({
            route_id,
            customers: result.rows.map(row => ({
                ...row,
                // Add visual hint for inactive customers without forcing status
                is_inactive: row.days_since_sale > 14
            })),
            total: result.rows.length
        });

    } catch (err) {
        handleError(res, err, 'Failed to fetch route customers');
    }
});

// POST add customer to route
router.post('/routes/:route_id/customers', authMiddleware, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
    const route_id = parseInt(req.params.route_id);
    const { customer_id } = req.body;
    const user_id = req.user.id;

    if (isNaN(route_id) || isNaN(customer_id)) {
        return res.status(400).json({ error: 'Invalid route or customer ID' });
    }

    try {
        const result = await query(
            'SELECT * FROM add_customer_to_route($1, $2, $3)',
            [customer_id, route_id, user_id]
        );

        res.json(result.rows[0]);

    } catch (err) {
        handleError(res, err, 'Failed to add customer to route');
    }
});

// DELETE remove customer from route
router.delete('/routes/:route_id/customers/:customer_id', authMiddleware, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
    const route_id = parseInt(req.params.route_id);
    const customer_id = parseInt(req.params.customer_id);
    const user_id = req.user.id;

    if (isNaN(route_id) || isNaN(customer_id)) {
        return res.status(400).json({ error: 'Invalid route or customer ID' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Soft delete the assignment
        await client.query(
            `UPDATE customer_route_assignments 
             SET is_active = false, updated_at = CURRENT_TIMESTAMP
             WHERE customer_id = $1 AND route_id = $2`,
            [customer_id, route_id]
        );

        // Log the removal
        await client.query(
            `INSERT INTO customer_route_changes (customer_id, route_id, action, changed_by)
             VALUES ($1, $2, 'removed', $3)`,
            [customer_id, route_id, user_id]
        );

        // Resequence remaining customers
        await client.query('SELECT resequence_route_customers($1)', [route_id]);

        await client.query('COMMIT');

        res.json({ success: true, message: 'Customer removed from route' });

    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, 'Failed to remove customer from route');
    } finally {
        client.release();
    }
});

// PUT update customer order (drag and drop)
router.put('/routes/:route_id/customer-order', authMiddleware, requireRole(['admin', 'manager', 'staff']), async (req, res) => {
    const route_id = parseInt(req.params.route_id);
    const { customer_ids } = req.body;
    const user_id = req.user.id;

    if (isNaN(route_id)) {
        return res.status(400).json({ error: 'Invalid route ID' });
    }

    if (!Array.isArray(customer_ids) || customer_ids.length === 0) {
        return res.status(400).json({ error: 'customer_ids must be a non-empty array' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Update sequences
        const updatePromises = customer_ids.map((customer_id, index) => {
            const sequence = (index + 1) * 100;
            return client.query(
                `UPDATE customer_route_assignments 
                 SET route_sequence = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE customer_id = $2 AND route_id = $3 AND is_active = true`,
                [sequence, customer_id, route_id]
            );
        });

        await Promise.all(updatePromises);

        // Log the resequencing
        await client.query(
            `INSERT INTO customer_route_changes (route_id, action, changed_by, notes)
             VALUES ($1, 'resequenced', $2, $3)`,
            [route_id, user_id, `Updated order for ${customer_ids.length} customers`]
        );

        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: `Updated order for ${customer_ids.length} customers`
        });

    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, 'Failed to update customer order');
    } finally {
        client.release();
    }
});

// GET customer search (for adding to routes)
router.get('/customers/search', authMiddleware, async (req, res) => {
    const { search, exclude_route_id, limit = 20 } = req.query;

    if (!search || search.length < 2) {
        return res.status(400).json({ error: 'Search term must be at least 2 characters' });
    }

    try {
        let sql = `
            SELECT 
                c.customer_id,
                c.customer_name,
                c.phone,
                c.address,
                COALESCE(
                    ARRAY_AGG(
                        DISTINCT dr.route_name 
                        ORDER BY dr.route_name
                    ) FILTER (WHERE dr.route_name IS NOT NULL), 
                    '{}'
                ) as current_routes
            FROM customers c
            LEFT JOIN customer_route_assignments cra ON c.customer_id = cra.customer_id AND cra.is_active = true
            LEFT JOIN delivery_routes dr ON cra.route_id = dr.route_id
            WHERE c.is_active = true
            AND (c.customer_name ILIKE $1 OR c.phone ILIKE $1)
        `;

        const values = [`%${search}%`];
        let paramIndex = 2;

        // Optionally exclude customers already on a specific route
        if (exclude_route_id) {
            sql += ` AND c.customer_id NOT IN (
                SELECT customer_id FROM customer_route_assignments 
                WHERE route_id = $${paramIndex} AND is_active = true
            )`;
            values.push(parseInt(exclude_route_id));
            paramIndex++;
        }

        sql += ` GROUP BY c.customer_id
                 ORDER BY c.customer_name
                 LIMIT $${paramIndex}`;
        values.push(parseInt(limit));

        const result = await query(sql, values);

        res.json(result.rows);

    } catch (err) {
        handleError(res, err, 'Failed to search customers');
    }
});

// GET route analytics (optional - for future dashboard)
router.get('/routes/:route_id/analytics', authMiddleware, async (req, res) => {
    const route_id = parseInt(req.params.route_id);

    if (isNaN(route_id)) {
        return res.status(400).json({ error: 'Invalid route ID' });
    }

    try {
        const sql = `
            SELECT 
                customer_status,
                customer_frequency,
                COUNT(*) as count
            FROM customer_route_analytics
            WHERE route_id = $1
            GROUP BY customer_status, customer_frequency
            ORDER BY customer_status, customer_frequency`;

        const result = await query(sql, [route_id]);

        res.json({
            route_id,
            analytics: result.rows,
            summary: {
                total_customers: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
                active: result.rows.filter(r => r.customer_status === 'active').reduce((sum, row) => sum + parseInt(row.count), 0),
                at_risk: result.rows.filter(r => r.customer_status === 'inactive').reduce((sum, row) => sum + parseInt(row.count), 0),
                lost: result.rows.filter(r => r.customer_status === 'lost').reduce((sum, row) => sum + parseInt(row.count), 0)
            }
        });

    } catch (err) {
        handleError(res, err, 'Failed to fetch route analytics');
    }
});

// === DELIVERY ROUTES ENDPOINTS === 
// Moved this section before GET /:id for customers to avoid route conflict

// GET all active delivery routes
router.get('/delivery-routes', authMiddleware, requireRole(['admin', 'accountant', 'manager', 'staff']), async (req, res) => {
    try {
        const result = await query('SELECT * FROM delivery_routes WHERE is_active = TRUE ORDER BY route_name ASC');
        res.json(result.rows);
    } catch (err) {
        handleError(res, err, "Failed to retrieve delivery routes");
    }
});

// POST a new delivery route
router.post('/delivery-routes', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res) => {
    const { route_name, route_description } = req.body;
    if (!route_name) {
        return res.status(400).json({ error: 'Route name is required.' });
    }
    try {
        const result = await query(
            'INSERT INTO delivery_routes (route_name, route_description) VALUES ($1, $2) RETURNING *',
            [route_name, route_description || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // unique_violation
            return handleError(res, err, `Delivery route name '${route_name}' already exists.`, 409);
        }
        handleError(res, err, "Failed to create delivery route");
    }
});

// PUT (update) an existing delivery route
router.put('/delivery-routes/:id', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res) => {
    const routeId = parseInt(req.params.id);
    const { route_name, route_description, is_active } = req.body;

    if (isNaN(routeId)) return res.status(400).json({ error: 'Invalid route ID.' });
    if (!route_name) return res.status(400).json({ error: 'Route name is required.' });

    try {
        const result = await query(
            'UPDATE delivery_routes SET route_name = $1, route_description = $2, is_active = $3, updated_at = NOW() WHERE route_id = $4 RETURNING *',
            [route_name, route_description || null, is_active === undefined ? true : is_active, routeId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Delivery route not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // unique_violation
            return handleError(res, err, `Delivery route name '${route_name}' already exists.`, 409);
        }
        handleError(res, err, "Failed to update delivery route");
    }
});

// DELETE (soft delete) a delivery route
router.delete('/delivery-routes/:id', authMiddleware, requireRole(['admin', 'accountant']), async (req, res) => {
    const routeId = parseInt(req.params.id);
    if (isNaN(routeId)) return res.status(400).json({ error: 'Invalid route ID.' });

    try {
        const customersCheck = await query('SELECT 1 FROM customers WHERE route_id = $1 AND is_active = TRUE LIMIT 1', [routeId]);
        if (customersCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Cannot deactivate route. It is currently assigned to active customers. Please reassign customers first.' });
        }
        const result = await query('UPDATE delivery_routes SET is_active = FALSE, updated_at = NOW() WHERE route_id = $1 RETURNING *', [routeId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Delivery route not found.' });
        }
        res.json({ message: 'Delivery route deactivated successfully.', route: result.rows[0] });
    } catch (err) {
        handleError(res, err, "Failed to deactivate delivery route");
    }
});

//credit-sales
router.get('/:customerId/credit-sales', authMiddleware, requireRole(['admin', 'accountant', 'manager', 'staff']), async (req, res) => {
    const customerId = parseInt(req.params.customerId);
    if (isNaN(customerId)) return res.status(400).json({ error: 'Invalid Customer ID.' });

    try {
        const sql = `
            SELECT sale_id, sale_timestamp, total_sale_amount 
            FROM driver_sales
            WHERE customer_id = $1 
              AND payment_type = 'Credit' 
              AND cleared_by_payment_id IS NULL
            ORDER BY sale_timestamp ASC;
        `;
        const result = await query(sql, [customerId]);
        res.json(result.rows);
    } catch (err) {
        handleError(res, err, "Failed to retrieve outstanding credit sales for customer.");
    }
});

// --- UPDATED ROUTE ---
//credit-sales
router.post(
    '/:customerId/credit-payments', 
    authMiddleware, 
    requireRole(['admin', 'accountant', 'manager', 'staff']), 
    upload.single('payment_slip_image'), 
    async (req, res) => {
        const customerId = parseInt(req.params.customerId);
        const { payment_date, amount_paid, payment_method, notes, cleared_sale_ids } = req.body;
        const created_by_user_id = req.user.id;

        // --- Validation ---
        if (isNaN(customerId)) return res.status(400).json({ error: 'Invalid customer ID.' });
        if (!payment_date || !amount_paid || !payment_method || !cleared_sale_ids) {
            return res.status(400).json({ error: 'Missing required payment details.' });
        }
        let clearedSaleIds;
        try {
            clearedSaleIds = JSON.parse(cleared_sale_ids);
            if (!Array.isArray(clearedSaleIds) || clearedSaleIds.length === 0) {
                 return res.status(400).json({ error: 'cleared_sale_ids must be a non-empty array.' });
            }
        } catch(e) {
             return res.status(400).json({ error: 'Invalid format for cleared_sale_ids.' });
        }

        const client = await getClient();
        try {
            // 1. Upload file to GCS first
            const slip_image_url = await uploadToGCS(req.file);

            await client.query('BEGIN');

            // 2. Create the payment record with the GCS URL
            const paymentResult = await client.query(
                `INSERT INTO customer_credit_payments (customer_id, payment_date, amount_paid, payment_method, notes, slip_image_url, created_by_user_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING payment_id`,
                [customerId, payment_date, parseFloat(amount_paid), payment_method, notes, slip_image_url, created_by_user_id]
            );
            const newPaymentId = paymentResult.rows[0].payment_id;

            // 3. Link the cleared sales to this payment and update their status
            const updateSalesQuery = `UPDATE driver_sales SET cleared_by_payment_id = $1 WHERE sale_id = ANY($2::int[]) AND customer_id = $3`;
            await client.query(updateSalesQuery, [newPaymentId, clearedSaleIds, customerId]);

            const linkSalesPromises = clearedSaleIds.map(saleId => {
                return client.query(
                    `INSERT INTO payment_cleared_sales (payment_id, driver_sale_id) VALUES ($1, $2)`,
                    [newPaymentId, saleId]
                );
            });
            await Promise.all(linkSalesPromises);

            await client.query('COMMIT');
            res.status(201).json({ message: 'Payment created successfully', payment_id: newPaymentId });
        } catch(err) {
            await client.query('ROLLBACK');
            handleError(res, err, "Failed to create credit payment.");
        } finally {
            client.release();
        }
    }
);

//credit-sales
router.get('/:customerId/credit-payments', authMiddleware, requireRole(['admin', 'accountant', 'manager',  'staff']), async (req, res) => {
    const customerId = parseInt(req.params.customerId);
    const { startDate, endDate } = req.query;

    if (isNaN(customerId)) return res.status(400).json({ error: 'Invalid Customer ID.' });

    let sql = `
        SELECT p.*, u.username as created_by_username
        FROM customer_credit_payments p
        JOIN users u ON p.created_by_user_id = u.id
        WHERE p.customer_id = $1
    `;
    const values = [customerId];
    let paramIndex = 2;

    if (startDate) {
        sql += ` AND p.payment_date >= $${paramIndex++}`;
        values.push(startDate);
    }
    if (endDate) {
        sql += ` AND p.payment_date <= $${paramIndex++}`;
        values.push(endDate);
    }
    sql += ` ORDER BY p.payment_date DESC, p.created_at DESC`;

    try {
        const result = await query(sql, values);
        res.json(result.rows);
    } catch (err) {
        handleError(res, err, "Failed to retrieve payment history.");
    }
});

// --- ADD THIS NEW ENDPOINT FOR VOIDING A PAYMENT ---
router.post('/credit-payments/:paymentId/void', authMiddleware, requireRole(['admin', 'manager']), async (req, res) => {
    const paymentId = parseInt(req.params.paymentId);
    const { void_reason } = req.body; // Optional reason for voiding
    const user_id = req.user.id;

    if (isNaN(paymentId)) return res.status(400).json({ error: 'Invalid Payment ID.' });

    const client = await getClient();
    try {
        await client.query('BEGIN');

        // 1. Mark the payment as voided
        const voidResult = await client.query(
            `UPDATE customer_credit_payments 
             SET is_voided = TRUE, notes = CONCAT(notes, E'\\nVOIDED by user ${user_id}: ${void_reason || 'No reason provided.'}')
             WHERE payment_id = $1 AND is_voided = FALSE RETURNING payment_id`,
            [paymentId]
        );

        if (voidResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Payment not found or already voided.' });
        }

        // 2. Find all sales cleared by this payment
        const clearedSalesResult = await client.query(
            `SELECT driver_sale_id FROM payment_cleared_sales WHERE payment_id = $1`,
            [paymentId]
        );
        const saleIdsToReopen = clearedSalesResult.rows.map(r => r.driver_sale_id);

        if (saleIdsToReopen.length > 0) {
            // 3. Unlink the sales from the payment by setting cleared_by_payment_id back to NULL
            await client.query(
                `UPDATE driver_sales SET cleared_by_payment_id = NULL WHERE sale_id = ANY($1::int[])`,
                [saleIdsToReopen]
            );
        }
        
        // Note: We don't delete from payment_cleared_sales to maintain a history of what this payment *used* to cover.

        await client.query('COMMIT');
        res.status(200).json({ message: 'Payment has been successfully voided.' });

    } catch(err) {
        await client.query('ROLLBACK');
        handleError(res, err, "Failed to void payment.");
    } finally {
        client.release();
    }
});

// --- ADD THIS NEW ENDPOINT FOR EDITING A PAYMENT ---
router.put('/credit-payments/:paymentId', authMiddleware, requireRole(['admin', 'manager']), async (req, res) => {
    const paymentId = parseInt(req.params.paymentId);
    // We only allow editing of non-critical data to preserve the audit trail
    const { payment_date, payment_method, notes } = req.body;
    
    if (isNaN(paymentId)) return res.status(400).json({ error: 'Invalid Payment ID.' });

    try {
        const result = await query(
            `UPDATE customer_credit_payments
             SET payment_date = $1, payment_method = $2, notes = $3, updated_at = NOW()
             WHERE payment_id = $4 AND is_voided = FALSE
             RETURNING *`,
            [payment_date, payment_method, notes, paymentId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment not found or is voided.' });
        }
        res.json(result.rows[0]);
    } catch(err) {
        handleError(res, err, "Failed to update payment details.");
    }
});

// === CUSTOMER ENDPOINTS ===
// POST: Create a new customer
router.post('/', authMiddleware, requireRole(['admin', 'accountant', 'manager', 'staff']), async (req, res) => {
    const { 
        customer_name, phone, address, contact_person, 
        customer_type, route_id, notes, is_active = true 
    } = req.body;
    const user_id_created_by = req.user.id; 

    if (!customer_name) {
        return res.status(400).json({ error: 'Customer name is required.' });
    }

    try {
        const result = await query(
            `INSERT INTO customers 
             (customer_name, phone, address, contact_person, customer_type, route_id, notes, is_active, user_id_created_by, user_id_last_updated_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING *`,
            [
                customer_name, phone || null, address || null, contact_person || null, 
                customer_type || null, route_id ? parseInt(route_id) : null, notes || null, 
                is_active, user_id_created_by
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23503' && err.constraint === 'customers_route_id_fkey') { 
            return handleError(res, err, 'Invalid route_id provided.', 400);
        }
        handleError(res, err, "Failed to create customer");
    }
});

// GET: List all customers (with filtering and pagination)
router.get('/', authMiddleware, requireRole(['admin', 'accountant', 'manager', 'staff']), async (req, res) => {
    const { 
        page = 1, limit = 20, search, route_id, customer_type, is_active 
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let mainQuery = `
        SELECT c.*, dr.route_name 
        FROM customers c
        LEFT JOIN delivery_routes dr ON c.route_id = dr.route_id
    `;
    let countQuery = `SELECT COUNT(c.*) FROM customers c`;
    
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // The logic to join and filter by driver has been completely removed.

    if (search) {
        conditions.push(`(c.customer_name ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex} OR c.contact_person ILIKE $${paramIndex})`);
        values.push(`%${search}%`);
        paramIndex++;
    }
    if (route_id) {
        conditions.push(`c.route_id = $${paramIndex++}`);
        values.push(parseInt(route_id));
    }
    if (customer_type) {
        conditions.push(`c.customer_type ILIKE $${paramIndex++}`);
        values.push(`%${customer_type}%`);
    }
    if (is_active !== undefined && is_active !== '') {
        conditions.push(`c.is_active = $${paramIndex++}`);
        values.push(is_active === 'true');
    }

    if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        mainQuery += whereClause;
        countQuery += whereClause;
    }

    mainQuery += ` ORDER BY c.customer_name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
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
        handleError(res, err, "Failed to retrieve customers");
    }
});

// GET: Get a single customer by ID
// This MUST be defined AFTER specific string routes like '/delivery-routes'
router.get('/:id', authMiddleware, requireRole(['admin', 'accountant', 'manager', 'staff']), async (req, res) => {
    const customerId = parseInt(req.params.id);
    if (isNaN(customerId)) return res.status(400).json({ error: 'Invalid customer ID.' });

    try {
        const result = await query(
            `SELECT c.*, dr.route_name 
             FROM customers c
             LEFT JOIN delivery_routes dr ON c.route_id = dr.route_id
             WHERE c.customer_id = $1`,
            [customerId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        handleError(res, err, "Failed to retrieve customer");
    }
});

// PUT: Update an existing customer
router.put('/:id', authMiddleware, requireRole(['admin', 'accountant', 'manager', 'staff']), async (req, res) => {
    const customerId = parseInt(req.params.id);
    const { 
        customer_name, phone, address, contact_person, 
        customer_type, route_id, notes, is_active 
    } = req.body;
    const user_id_last_updated_by = req.user.id;

    if (isNaN(customerId)) return res.status(400).json({ error: 'Invalid customer ID.' });
    if (!customer_name) return res.status(400).json({ error: 'Customer name is required.' });

    try {
        const result = await query(
            `UPDATE customers 
             SET customer_name = $1, phone = $2, address = $3, contact_person = $4, 
                 customer_type = $5, route_id = $6, notes = $7, is_active = $8, 
                 user_id_last_updated_by = $9, updated_at = NOW()
             WHERE customer_id = $10 RETURNING *`,
            [
                customer_name, phone || null, address || null, contact_person || null,
                customer_type || null, route_id ? parseInt(route_id) : null, notes || null,
                is_active === undefined ? true : is_active, 
                user_id_last_updated_by, customerId
            ]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23503' && err.constraint === 'customers_route_id_fkey') { 
            return handleError(res, err, 'Invalid route_id provided.', 400);
        }
        handleError(res, err, "Failed to update customer");
    }
});

// DELETE: Soft delete a customer (set is_active = false)
router.delete('/:id', authMiddleware, requireRole(['admin', 'accountant']), async (req, res) => {
    const customerId = parseInt(req.params.id);
    const user_id_last_updated_by = req.user.id;

    if (isNaN(customerId)) return res.status(400).json({ error: 'Invalid customer ID.' });

    try {
        const result = await query(
            `UPDATE customers 
             SET is_active = FALSE, user_id_last_updated_by = $1, updated_at = NOW() 
             WHERE customer_id = $2 RETURNING *`,
            [user_id_last_updated_by, customerId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found.' });
        }
        res.json({ message: 'Customer deactivated successfully.', customer: result.rows[0] });
    } catch (err) {
        handleError(res, err, "Failed to deactivate customer");
    }
});

module.exports = router;
