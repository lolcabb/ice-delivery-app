// ice-delivery-app/routes/routes.js
const express = require('express');
const router = express.Router();
const { query, getClient } = require('../db/postgres');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid'); 

// --- Helper function for error handling ---
const handleError = (res, error, message = "An error occurred", statusCode = 500) => {
    console.error(message, error);
    const errorMessage = process.env.NODE_ENV === 'production' && statusCode === 500
        ? "An unexpected error occurred on the server."
        : `${message}: ${error.message || error}`;
    res.status(statusCode).json({ error: errorMessage });
};

// Simplified API routes for customer-route management

// GET /api/routes/:route_id/customers
// Get all customers assigned to a specific route
router.get('/routes/:route_id/customers', authMiddleware, async (req, res) => {
    const route_id = parseInt(req.params.route_id);
    
    if (isNaN(route_id)) {
        return res.status(400).json({ error: 'Invalid route ID' });
    }

    try {
        // First, check if we have any assignments
        const assignmentCheck = await query(
            'SELECT COUNT(*) as count FROM customer_route_assignments WHERE route_id = $1 AND is_active = true',
            [route_id]
        );

        if (assignmentCheck.rows[0].count === 0) {
            // No assignments yet - this is normal for new routes
            // Option 1: Return empty array
            return res.json({
                route_id,
                customers: [],
                total: 0,
                message: 'No customers assigned to this route yet'
            });

            // Option 2: Return ALL customers for easy assignment
            // Uncomment below if you prefer this approach
            /*
            const allCustomersSQL = `
                SELECT 
                    c.customer_id,
                    c.customer_name,
                    c.phone,
                    c.address,
                    c.route_id as original_route_id,
                    999999 as route_sequence,
                    NULL as days_since_sale
                FROM customers c
                WHERE c.is_active = true
                ORDER BY c.customer_name
            `;
            const allCustomers = await query(allCustomersSQL);
            
            return res.json({
                route_id,
                customers: allCustomers.rows,
                total: allCustomers.rows.length,
                all_customers_mode: true,
                message: 'Showing all customers - drag to assign to this route'
            });
            */
        }

        // We have assignments - use the function
        const sql = `SELECT * FROM get_route_customers_for_sales($1)`;
        const result = await query(sql, [route_id]);
        
        res.json({
            route_id,
            customers: result.rows,
            total: result.rows.length
        });

    } catch (err) {
        console.error('Error in /routes/:route_id/customers:', err);
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
