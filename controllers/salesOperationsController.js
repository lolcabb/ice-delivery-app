// ice-delivery-app/routes/salesOperations.js
const { query, getClient, pool } = require("../db/postgres");
const { v4: uuidv4, validate: uuidValidate } = require('uuid'); 

// --- Helper function for error handling ---
const handleError = (res, error, message = "An error occurred", statusCode = 500) => {
    console.error(message, error);
    const errorMessage = process.env.NODE_ENV === 'production' && statusCode === 500
        ? "An unexpected error occurred on the server."
        : `${message}: ${error.message || error}`;
    res.status(statusCode).json({ error: errorMessage });
};

// Helper for uuid validation (example, if not using a library that provides it)
// This is a simple regex, for robust validation use a library or PostgreSQL's own type checking
const uuidValidateRegex = (uuid) => {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

// --- Helper function to update financial totals on driver_daily_summary ---
const updateDriverDailySummaryTotals = async (client, driverDailySummaryId) => {
    console.log(`[SalesOps Helper] Updating totals for driver_daily_summary_id: ${driverDailySummaryId}`);
    if (!driverDailySummaryId) {
        console.error("[SalesOps Helper] Error: driverDailySummaryId is undefined or null.");
        throw new Error("Cannot update summary totals without a valid driverDailySummaryId.");
    }
    const salesValuesSql = `
        SELECT 
            COALESCE(SUM(CASE WHEN ds.payment_type = 'Cash' THEN ds.total_sale_amount ELSE 0 END), 0) AS total_cash_sales,
            COALESCE(SUM(CASE WHEN ds.payment_type = 'Credit' THEN ds.total_sale_amount ELSE 0 END), 0) AS total_credit_sales,
            COALESCE(SUM(CASE WHEN ds.payment_type NOT IN ('Cash', 'Credit') OR ds.payment_type IS NULL THEN ds.total_sale_amount ELSE 0 END), 0) AS total_other_sales
        FROM driver_sales ds
        WHERE ds.driver_daily_summary_id = $1;
    `;
    const salesValuesResult = await client.query(salesValuesSql, [driverDailySummaryId]);
    const { 
        total_cash_sales, 
        total_credit_sales,
        total_other_sales
    } = salesValuesResult.rows[0] || { total_cash_sales: 0, total_credit_sales: 0, total_other_sales: 0 };

    const updateSummarySql = `
        UPDATE driver_daily_summaries SET
            total_cash_sales_value = $1,
            total_new_credit_sales_value = $2,
            total_other_payment_sales_value = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE summary_id = $4
        RETURNING *; 
    `;
    const updatedSummaryResult = await client.query(updateSummarySql, [
        parseFloat(total_cash_sales),
        parseFloat(total_credit_sales),
        parseFloat(total_other_sales),
        driverDailySummaryId
    ]);
    console.log(`[SalesOps Helper] Totals updated for summary_id: ${driverDailySummaryId}. Cash: ${total_cash_sales}, Credit: ${total_credit_sales}, Other: ${total_other_sales}`);
    if (updatedSummaryResult.rows.length === 0) {
        console.warn(`[SalesOps Helper] No summary found for summary_id: ${driverDailySummaryId} during total update.`);
    }
    return updatedSummaryResult.rows[0];
};

// GET /api/sales-ops/routes/:routeId/customers
// This now correctly joins and orders by the route_sequence
exports.getRouteCustomers = async (req, res) => { // FIXED: Using authMiddleware
    const { routeId } = req.params;
    try {
        const query = `
            SELECT 
                c.customer_id,
                c.customer_name,
                c.phone,
                c.address,
                cra.route_sequence
            FROM customers c
            JOIN customer_route_assignments cra ON c.customer_id = cra.customer_id
            WHERE cra.route_id = $1 AND cra.is_active = true
            ORDER BY cra.route_sequence ASC, c.customer_name ASC;
        `;
        const { rows } = await pool.query(query, [routeId]);
        res.json({ customers: rows });
    } catch (err) {
        console.error('Error fetching route customers:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /api/sales-ops/routes/:routeId/customers
// Adds a single customer to a route, placing them at the end of the sequence.
exports.addRouteCustomer = async (req, res) => { // FIXED: Using authMiddleware
    const { routeId } = req.params;
    const { customer_id } = req.body;

    if (!customer_id) {
        return res.status(400).json({ error: 'Customer ID is required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existingAssignment = await client.query(
            'SELECT * FROM customer_route_assignments WHERE route_id = $1 AND customer_id = $2',
            [routeId, customer_id]
        );

        if (existingAssignment.rows.length > 0) {
            await client.query(
                'UPDATE customer_route_assignments SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE assignment_id = $1',
                [existingAssignment.rows[0].assignment_id]
            );
        } else {
            const maxSeqResult = await client.query(
                'SELECT MAX(route_sequence) as max_seq FROM customer_route_assignments WHERE route_id = $1',
                [routeId]
            );
            const newSequence = (maxSeqResult.rows[0].max_seq || 0) + 1;

            await client.query(
                `INSERT INTO customer_route_assignments (customer_id, route_id, route_sequence, is_active, created_by)
                 VALUES ($1, $2, $3, true, $4)`,
                [customer_id, routeId, newSequence, req.user.id] // This will now work correctly
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Customer added to route successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding customer to route:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

// DELETE /api/sales-ops/routes/:routeId/customers/:customerId
// Deactivates a customer from a route instead of hard deleting
exports.removeRouteCustomer = async (req, res) => { // FIXED: Using authMiddleware
    const { routeId, customerId } = req.params;
    try {
        const result = await pool.query(
            `UPDATE customer_route_assignments 
             SET is_active = false, updated_at = CURRENT_TIMESTAMP 
             WHERE route_id = $1 AND customer_id = $2`,
            [routeId, customerId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Assignment not found.' });
        }
        res.status(200).json({ message: 'Customer removed from route.' });
    } catch (err) {
        console.error('Error removing customer from route:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// PUT /api/sales-ops/routes/:routeId/customer-order
// This now correctly performs a bulk update of the sequence.
exports.updateRouteCustomerOrder = async (req, res) => { // FIXED: Using authMiddleware
    const { routeId } = req.params;
    const { customer_ids } = req.body;

    if (!Array.isArray(customer_ids)) {
        return res.status(400).json({ error: 'customer_ids must be an array.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updatePromises = customer_ids.map((customerId, index) => {
            const sequence = index + 1;
            return client.query(
                `UPDATE customer_route_assignments
                 SET route_sequence = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE route_id = $2 AND customer_id = $3`,
                [sequence, routeId, customerId]
            );
        });

        await Promise.all(updatePromises);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Customer order updated successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating customer order:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

// GET customer prices for sales entry
exports.getCustomerPrices = async (req, res) => {
    const customer_id = parseInt(req.params.customer_id);
    
    if (isNaN(customer_id)) {
        return res.status(400).json({ error: 'Invalid customer ID' });
    }

    try {
        const sql = 'SELECT * FROM get_customer_all_prices($1)';
        const result = await query(sql, [customer_id]);
        
        res.json({
            customer_id,
            prices: result.rows
        });

    } catch (err) {
        handleError(res, err, 'Failed to fetch customer prices');
    }
};

// PUT update customer price
exports.updateCustomerPrice = async (req, res) => {
    const customer_id = parseInt(req.params.customer_id);
    const product_id = parseInt(req.params.product_id);
    const { unit_price, reason } = req.body;
    const user_id = req.user.id;

    if (isNaN(customer_id) || isNaN(product_id) || isNaN(parseFloat(unit_price))) {
        return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
        const result = await query(
            'SELECT * FROM set_customer_price($1, $2, $3, $4, $5)',
            [customer_id, product_id, parseFloat(unit_price), user_id, reason]
        );

        res.json(result.rows[0]);

    } catch (err) {
        handleError(res, err, 'Failed to update customer price');
    }
};

// Enhanced batch sales save with pricing
exports.batchSalesEntry = async (req, res) => {
    const { driver_daily_summary_id, sales_data } = req.body;
    const area_manager_id = req.user.id;

    console.log(`[SalesOps API] POST /sales-entry/batch - User: ${area_manager_id}, Summary: ${driver_daily_summary_id}`);

    if (!driver_daily_summary_id || !Array.isArray(sales_data)) {
        return res.status(400).json({ error: 'Invalid request data. driver_daily_summary_id and sales_data array are required.' });
    }

    if (sales_data.length === 0) {
        return res.status(400).json({ error: 'At least one sale record is required.' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');
        console.log(`[SalesOps API] Transaction BEGIN for batch sales save`);

        // Get route_id from summary for updating customer assignments
        const summaryResult = await client.query(
            'SELECT route_id, driver_id FROM driver_daily_summaries WHERE summary_id = $1',
            [driver_daily_summary_id]
        );
        
        if (summaryResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Driver daily summary not found.' });
        }
        
        const { route_id, driver_id } = summaryResult.rows[0];

        // Clear existing sales for this summary (for complete replacement)
        await client.query(
            'DELETE FROM driver_sales WHERE driver_daily_summary_id = $1',
            [driver_daily_summary_id]
        );

        let processedSalesCount = 0;
        let totalSalesAmount = 0;

        // Process each sale
        for (const sale of sales_data) {
            if (!sale.customer_id || !sale.items || sale.items.length === 0) {
                console.warn(`[SalesOps API] Skipping sale for customer ${sale.customer_id} - no items or invalid data`);
                continue;
            }

            // Validate customer exists
            const customerCheck = await client.query(
                'SELECT customer_id FROM customers WHERE customer_id = $1 AND is_active = true',
                [sale.customer_id]
            );
            
            if (customerCheck.rows.length === 0) {
                console.warn(`[SalesOps API] Skipping sale - Customer ${sale.customer_id} not found or inactive`);
                continue;
            }

            // Create the sale record
            const saleResult = await client.query(
                `INSERT INTO driver_sales (
                    driver_daily_summary_id, customer_id, payment_type, 
                    notes, area_manager_logged_by_id, total_sale_amount
                ) VALUES ($1, $2, $3, $4, $5, 0) RETURNING sale_id`,
                [
                    driver_daily_summary_id,
                    sale.customer_id,
                    sale.payment_type || 'Cash',
                    sale.notes || null,
                    area_manager_id
                ]
            );

            const sale_id = saleResult.rows[0].sale_id;
            let sale_total_amount = 0;

            // Insert sale items with pricing and transaction types
            for (const item of sale.items) {
                const quantity = parseFloat(item.quantity_sold);
                if (!quantity || quantity <= 0) {
                    console.warn(`[SalesOps API] Skipping item - invalid quantity: ${quantity}`);
                    continue;
                }

                // Validate product exists
                const productCheck = await client.query(
                    'SELECT product_id, default_unit_price FROM products WHERE product_id = $1',
                    [item.product_id]
                );
                
                if (productCheck.rows.length === 0) {
                    console.warn(`[SalesOps API] Skipping item - Product ${item.product_id} not found`);
                    continue;
                }

                const defaultPrice = productCheck.rows[0].default_unit_price;

                // Determine unit price
                let unit_price = parseFloat(item.unit_price);
                if (!unit_price || unit_price < 0) {
                    // Try to get customer-specific price
                    const customerPriceResult = await client.query(
                        'SELECT unit_price FROM customer_prices WHERE customer_id = $1 AND product_id = $2 ORDER BY effective_date DESC LIMIT 1',
                        [sale.customer_id, item.product_id]
                    );
                    
                    unit_price = customerPriceResult.rows.length > 0 
                        ? parseFloat(customerPriceResult.rows[0].unit_price)
                        : parseFloat(defaultPrice) || 0;
                }

                // Calculate total based on transaction type
                const transaction_type = item.transaction_type || 'Sale';
                let item_total = 0;
                
                if (transaction_type === 'Sale') {
                    item_total = quantity * unit_price;
                    sale_total_amount += item_total;
                } else if (transaction_type === 'Giveaway') {
                    // Giveaways have zero value but we track the unit price for reference
                    item_total = 0;
                } else if (transaction_type === 'Internal Use') {
                    // Internal use typically has zero value too
                    item_total = 0;
                }

                // Insert the sale item
                await client.query(
                    `INSERT INTO driver_sale_items (
                        driver_sale_id, product_id, quantity_sold, 
                        unit_price, transaction_type
                    ) VALUES ($1, $2, $3, $4, $5)`,
                    [
                        sale_id,
                        item.product_id,
                        quantity,
                        unit_price,
                        transaction_type
                    ]
                );

                console.log(`[SalesOps API] Inserted sale item: Product ${item.product_id}, Qty: ${quantity}, Price: ${unit_price}, Type: ${transaction_type}, Total: ${item_total}`);
            }

            // Update sale total
            await client.query(
                'UPDATE driver_sales SET total_sale_amount = $1 WHERE sale_id = $2',
                [sale_total_amount, sale_id]
            );

            totalSalesAmount += sale_total_amount;

            // Update customer-route assignment last sale date and sales count
            if (route_id) {
                await client.query(
                    `INSERT INTO customer_route_assignments (customer_id, route_id, last_sale_date, total_sales_count, is_active)
                     VALUES ($1, $2, CURRENT_DATE, 1, true)
                     ON CONFLICT (customer_id, route_id) 
                     DO UPDATE SET 
                         last_sale_date = CURRENT_DATE,
                         total_sales_count = customer_route_assignments.total_sales_count + 1,
                         is_active = true`,
                    [sale.customer_id, route_id]
                );
            }

            processedSalesCount++;
        }

        // Update summary totals
        await updateDriverDailySummaryTotals(client, driver_daily_summary_id);

        await client.query('COMMIT');
        console.log(`[SalesOps API] Transaction COMMIT. Processed ${processedSalesCount} sales with total amount ${totalSalesAmount}`);

        res.json({
            success: true,
            message: `Successfully saved ${processedSalesCount} sales records`,
            processed_sales: processedSalesCount,
            total_amount: totalSalesAmount
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[SalesOps API] Transaction ROLLBACK for batch sales save. Error: ${err.message}`);
        handleError(res, err, 'Failed to save batch sales');
    } finally {
        client.release();
    }
};

// GET sales for editing
exports.getDriverSalesForEdit = async (req, res) => {
    const summary_id = parseInt(req.params.summary_id);

    if (isNaN(summary_id)) {
        return res.status(400).json({ error: 'Invalid summary ID' });
    }

    try {
        // Get all sales with full details for editing
        const salesSql = `
            SELECT 
                ds.sale_id,
                ds.customer_id,
                c.customer_name,
                ds.payment_type,
                ds.notes,
                ds.total_sale_amount,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'item_id', dsi.item_id,
                            'product_id', dsi.product_id,
                            'product_name', p.product_name,
                            'quantity_sold', dsi.quantity_sold,
                            'unit_price', dsi.unit_price,
                            'transaction_type', dsi.transaction_type,
                            'total_amount', dsi.total_amount
                        ) ORDER BY dsi.item_id
                    ) FILTER (WHERE dsi.item_id IS NOT NULL), 
                    '[]'
                ) as items
            FROM driver_sales ds
            JOIN customers c ON ds.customer_id = c.customer_id
            LEFT JOIN driver_sale_items dsi ON ds.sale_id = dsi.driver_sale_id
            LEFT JOIN products p ON dsi.product_id = p.product_id
            WHERE ds.driver_daily_summary_id = $1
            GROUP BY ds.sale_id, ds.customer_id, c.customer_name, ds.payment_type, ds.notes, ds.total_sale_amount
            ORDER BY c.customer_name, ds.sale_id
        `;

        const result = await query(salesSql, [summary_id]);

        res.json({
            success: true,
            sales: result.rows
        });

    } catch (err) {
        handleError(res, err, 'Failed to fetch sales for editing');
    }
};

// PUT update individual sale (for corrections)
exports.updateDriverSaleSimple = async (req, res) => {
    const sale_id = parseInt(req.params.sale_id);
    const { payment_type, notes, items } = req.body;
    const user_id = req.user.id;

    if (isNaN(sale_id)) {
        return res.status(400).json({ error: 'Invalid sale ID' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        // Update sale header if needed
        if (payment_type || notes !== undefined) {
            const updates = [];
            const values = [];
            let paramIndex = 1;

            if (payment_type) {
                updates.push(`payment_type = $${paramIndex++}`);
                values.push(payment_type);
            }
            if (notes !== undefined) {
                updates.push(`notes = $${paramIndex++}`);
                values.push(notes);
            }

            if (updates.length > 0) {
                values.push(sale_id);
                await client.query(
                    `UPDATE driver_sales 
                     SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
                     WHERE sale_id = $${paramIndex}`,
                    values
                );
            }
        }

        // Update items if provided
        if (items && Array.isArray(items)) {
            // Delete existing items
            await client.query(
                'DELETE FROM driver_sale_items WHERE driver_sale_id = $1',
                [sale_id]
            );

            // Re-insert updated items
            let total_amount = 0;
            for (const item of items) {
                if (item.quantity_sold && parseFloat(item.quantity_sold) > 0) {
                    const quantity = parseFloat(item.quantity_sold);
                    const unit_price = parseFloat(item.unit_price);
                    const subtotal = quantity * unit_price;
                    total_amount += subtotal;

                    await client.query(
                        `INSERT INTO driver_sale_items (
                            driver_sale_id, product_id, quantity_sold,
                            unit_price, subtotal, transaction_type
                        ) VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            sale_id,
                            item.product_id,
                            quantity,
                            unit_price,
                            subtotal,
                            item.transaction_type || 'Sale'
                        ]
                    );
                }
            }

            // Update total
            await client.query(
                'UPDATE driver_sales SET total_sale_amount = $1 WHERE sale_id = $2',
                [total_amount, sale_id]
            );
        }

        // Update summary totals
        const summaryResult = await client.query(
            'SELECT driver_daily_summary_id FROM driver_sales WHERE sale_id = $1',
            [sale_id]
        );
        
        if (summaryResult.rows[0]) {
            await updateDriverDailySummaryTotals(client, summaryResult.rows[0].driver_daily_summary_id);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Sale updated successfully'
        });

    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, 'Failed to update sale');
    } finally {
        client.release();
    }
};

// DELETE sale (soft delete with reason)
exports.deleteDriverSaleSimple = async (req, res) => {
    const sale_id = parseInt(req.params.sale_id);
    const { reason } = req.body;
    const user_id = req.user.id;

    if (isNaN(sale_id)) {
        return res.status(400).json({ error: 'Invalid sale ID' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        // Get summary_id before deletion
        const saleResult = await client.query(
            'SELECT driver_daily_summary_id, customer_id FROM driver_sales WHERE sale_id = $1',
            [sale_id]
        );

        if (saleResult.rows.length === 0) {
            throw new Error('Sale not found');
        }

        const { driver_daily_summary_id, customer_id } = saleResult.rows[0];

        // Log the deletion
        await client.query(
            `INSERT INTO sales_audit_log (
                sale_id, action, action_by, action_reason, 
                original_data
            ) VALUES (
                $1, 'deleted', $2, $3,
                (SELECT row_to_json(ds) FROM driver_sales ds WHERE sale_id = $1)
            )`,
            [sale_id, user_id, reason]
        );

        // Delete sale items first
        await client.query(
            'DELETE FROM driver_sale_items WHERE driver_sale_id = $1',
            [sale_id]
        );

        // Delete the sale
        await client.query(
            'DELETE FROM driver_sales WHERE sale_id = $1',
            [sale_id]
        );

        // Update summary totals
        await updateDriverDailySummaryTotals(client, driver_daily_summary_id);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Sale deleted successfully'
        });

    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, 'Failed to delete sale');
    } finally {
        client.release();
    }
};

// POST /api/sales-ops/batch-returns - New transactional endpoint
exports.batchReturns = async (req, res) => {
    const { driver_id, return_date, product_items, packaging_items, driver_daily_summary_id } = req.body;
    const area_manager_id = req.user.id;

    // --- Basic Validation ---
    if (!driver_id || !return_date || !driver_daily_summary_id) {
        return res.status(400).json({ error: 'Driver ID, Return Date, and Summary ID are required.' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        // --- Process Product Returns ---
        // First, clear out old product returns for this day for this driver to prevent duplicates
        await client.query('DELETE FROM product_returns WHERE driver_id = $1 AND return_date = $2', [driver_id, return_date]);
        
        if (Array.isArray(product_items) && product_items.length > 0) {
            const productInsertPromises = product_items.map(item => {
                const sql = `
                    INSERT INTO product_returns
                    (driver_id, return_date, product_id, quantity_returned, loss_reason_id, custom_reason_for_loss, area_manager_id, notes, driver_daily_summary_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `;
                return client.query(sql, [
                    driver_id, return_date, item.product_id, item.quantity_returned,
                    item.loss_reason_id, item.custom_reason_for_loss, area_manager_id,
                    item.notes, driver_daily_summary_id
                ]);
            });
            await Promise.all(productInsertPromises);
        }

        // --- Process Packaging Logs ---
        // Clear out old packaging logs for this day for this driver
        await client.query('DELETE FROM packaging_logs WHERE driver_id = $1 AND log_date = $2', [driver_id, return_date]);

        if (Array.isArray(packaging_items) && packaging_items.length > 0) {
            const packagingInsertPromises = packaging_items.map(item => {
                const sql = `
                    INSERT INTO packaging_logs
                    (driver_id, log_date, packaging_type_id, quantity_out, quantity_returned, area_manager_id, notes, driver_daily_summary_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `;
                return client.query(sql, [
                    driver_id, return_date, item.packaging_type_id, item.quantity_out,
                    item.quantity_returned, area_manager_id, item.notes, driver_daily_summary_id
                ]);
            });
            await Promise.all(packagingInsertPromises);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'All returns and packaging logs saved successfully.' });

    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, "Failed to save batch returns");
    } finally {
        client.release();
    }
};

// GET /api/sales-ops/reconciliation-summary?driver_id=X&date=YYYY-MM-DD
exports.getReconciliationSummary = async (req, res) => {
    const { driver_id, date } = req.query;

    if (!driver_id || !date) {
        return res.status(400).json({ error: 'Driver ID and Date are required.' });
    }

    try {
        // This single, powerful query aggregates all data needed for the reconciliation screen.
        const reconciliationQuery = `
            WITH loaded_quantities AS (
                SELECT product_id, SUM(quantity_loaded) as total_loaded
                FROM loading_logs
                WHERE driver_id = $1 AND DATE(load_timestamp AT TIME ZONE 'Asia/Bangkok') = $2
                GROUP BY product_id
            ),
            sold_quantities AS (
                SELECT dsi.product_id, SUM(dsi.quantity_sold) as total_sold
                FROM driver_sale_items dsi
                JOIN driver_sales ds ON dsi.driver_sale_id = ds.sale_id
                JOIN driver_daily_summaries dds ON ds.driver_daily_summary_id = dds.summary_id
                WHERE dds.driver_id = $1 AND dds.sale_date = $2
                GROUP BY dsi.product_id
            ),
            returned_quantities AS (
                SELECT product_id, SUM(quantity_returned) as total_returned
                FROM product_returns
                WHERE driver_id = $1 AND return_date = $2
                GROUP BY product_id
            )
            SELECT 
                p.product_id,
                p.product_name,
                COALESCE(lq.total_loaded, 0) AS loaded,
                COALESCE(sq.total_sold, 0) AS sold,
                COALESCE(rq.total_returned, 0) AS returned,
                (COALESCE(lq.total_loaded, 0) - COALESCE(sq.total_sold, 0) - COALESCE(rq.total_returned, 0)) as loss
            FROM products p
            LEFT JOIN loaded_quantities lq ON p.product_id = lq.product_id
            LEFT JOIN sold_quantities sq ON p.product_id = sq.product_id
            LEFT JOIN returned_quantities rq ON p.product_id = rq.product_id
            WHERE COALESCE(lq.total_loaded, 0) > 0 OR COALESCE(sq.total_sold, 0) > 0 OR COALESCE(rq.total_returned, 0) > 0
            ORDER BY p.product_id;
        `;

        // We also need to fetch the summary separately to get cash details etc.
        const summaryQuery = `
            SELECT 
                dds.*,
                r.route_name,
                (SELECT SUM(quantity_loaded) 
                 FROM loading_logs ll 
                 WHERE ll.driver_id = dds.driver_id 
                   AND DATE(ll.load_timestamp AT TIME ZONE 'Asia/Bangkok') = dds.sale_date
                ) as total_products_loaded
            FROM driver_daily_summaries dds
            LEFT JOIN delivery_routes r ON dds.route_id = r.route_id
            WHERE dds.driver_id = $1 AND dds.sale_date = $2 
            LIMIT 1
        `;
        
        const [reconciliationResult, summaryResult] = await Promise.all([
            query(reconciliationQuery, [driver_id, date]),
            query(summaryQuery, [driver_id, date])
        ]);
        
        if (summaryResult.rows.length === 0) {
             return res.status(404).json({ error: 'No sales summary found for this driver on this date. Please complete sales or returns entry first.' });
        }

        res.json({
            summary: summaryResult.rows[0],
            product_reconciliation: reconciliationResult.rows
        });

    } catch (err) {
        handleError(res, err, "Failed to generate reconciliation summary");
    }
};

// === PRODUCTS ===
exports.getProducts = async (req, res) => {
    try {
        const result = await query('SELECT product_id, product_name, default_unit_price, unit_of_measure FROM products WHERE is_active = TRUE ORDER BY product_id ASC');
        res.json(result.rows);
    } catch (err) {
        handleError(res, err, "Failed to retrieve sales products");
    }
};

// === LOADING LOGS ===
exports.createLoadingLogs = async (req, res) => {
    const { driver_id, route_id, load_type = 'initial', load_timestamp, notes, items } = req.body;
    const area_manager_id = req.user.id;

    console.log(`[SalesOps API] POST /loading-logs (batch) - User: ${area_manager_id}, Received Driver ID: ${driver_id}`);

    if (!driver_id || isNaN(parseInt(driver_id))) {
        return res.status(400).json({ error: 'Valid Driver ID is required.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one product item is required in the "items" array.' });
    }
    if (route_id && isNaN(parseInt(route_id))) {
        return res.status(400).json({ error: 'Invalid Route ID.' });
    }
    const finalLoadTimestamp = load_timestamp ? new Date(load_timestamp) : new Date();
    if (isNaN(finalLoadTimestamp.getTime())) {
        return res.status(400).json({ error: 'Invalid load_timestamp format.' });
    }

    for (const item of items) {
        if (!item.product_id || isNaN(parseInt(item.product_id))) {
            return res.status(400).json({ error: 'Each item must have a valid Product ID.' });
        }
        if (item.quantity_loaded === undefined || isNaN(parseFloat(item.quantity_loaded)) || parseFloat(item.quantity_loaded) <= 0) {
            return res.status(400).json({ error: `Quantity Loaded for product ID ${item.product_id} must be a positive number.` });
        }
    }

    const client = await getClient();
    const batchUUID = uuidv4(); 

    try {
        await client.query('BEGIN');
        console.log(`[SalesOps API] Transaction BEGIN for batch loading log (UUID: ${batchUUID}) for driver ${driver_id}`);

        // *** START OF FIX ***
        // Add a definitive check to verify the driver_id exists before attempting to insert.
        const driverCheckResult = await client.query('SELECT driver_id FROM drivers WHERE driver_id = $1', [parseInt(driver_id)]);
        if (driverCheckResult.rows.length === 0) {
            // If the driver doesn't exist, we can give a very specific error and stop.
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Operation failed: The provided Driver ID (${driver_id}) does not exist in the database.` });
        }
        // *** END OF FIX ***

        const insertPromises = items.map(item => {
            const sql = `
                INSERT INTO loading_logs 
                (driver_id, route_id, product_id, quantity_loaded, load_type, load_timestamp, area_manager_id, notes, load_batch_uuid)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *; 
            `;
            const values = [
                parseInt(driver_id),
                route_id ? parseInt(route_id) : null,
                parseInt(item.product_id),
                parseFloat(item.quantity_loaded),
                load_type,
                finalLoadTimestamp, 
                area_manager_id,
                notes || null,
                batchUUID 
            ];
            return client.query(sql, values);
        });

        const results = await Promise.all(insertPromises);
        
        const commonData = results[0]?.rows[0] ? {
            driver_id: results[0].rows[0].driver_id,
            route_id: results[0].rows[0].route_id,
            load_type: results[0].rows[0].load_type,
            load_timestamp: results[0].rows[0].load_timestamp,
            area_manager_id: results[0].rows[0].area_manager_id,
            notes: results[0].rows[0].notes,
            load_batch_uuid: batchUUID
        } : {};

        const createdItems = results.map(r => ({
            loading_log_id: r.rows[0].loading_log_id,
            product_id: r.rows[0].product_id,
            quantity_loaded: r.rows[0].quantity_loaded
        }));

        let driverNameResult, areaManagerNameResult, routeNameResult;
        if (commonData.driver_id) {
            driverNameResult = await client.query('SELECT first_name, last_name FROM drivers WHERE driver_id = $1', [commonData.driver_id]);
        }
        if (commonData.area_manager_id) {
            areaManagerNameResult = await client.query('SELECT username FROM users WHERE id = $1', [commonData.area_manager_id]);
        }
        if (commonData.route_id) {
            routeNameResult = await client.query('SELECT route_name FROM delivery_routes WHERE route_id = $1', [commonData.route_id]);
        }
        
        await client.query('COMMIT');
        console.log(`[SalesOps API] Transaction COMMIT. ${createdItems.length} loading logs created with batch UUID: ${batchUUID}.`);
        
        res.status(201).json({
            ...commonData,
            items: createdItems,
            driver_name: driverNameResult?.rows[0] ? `${driverNameResult.rows[0].first_name} ${driverNameResult.rows[0].last_name || ''}`.trim() : null,
            area_manager_name: areaManagerNameResult?.rows[0]?.username || null,
            route_name: routeNameResult?.rows[0]?.route_name || null,
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[SalesOps API] Transaction ROLLBACK for batch loading log. Error: ${err.message}`);
        if (err.code === '23503') { 
            return handleError(res, err, 'Invalid reference ID provided (Driver, Product, or Route).', 400);
        }
        handleError(res, err, "Failed to create loading log entries");
    } finally {
        client.release();
    }
};

// GET /api/sales-ops/loading-logs?driver_id=X&date=YYYY-MM-DD (Corrected Joins)
exports.getLoadingLogs = async (req, res) => {
    const { driver_id, date, driver_name } = req.query;
    const requesting_user_id = req.user.id;

    console.log(`[SalesOps API] GET /loading-logs - User: ${requesting_user_id}, Query: ${JSON.stringify(req.query)}`);
    
    const TARGET_TIMEZONE = 'Asia/Bangkok'; 

    let sql = `
        SELECT ll.loading_log_id, ll.driver_id, ll.route_id, ll.product_id, ll.quantity_loaded, 
               ll.load_type, ll.load_timestamp, ll.area_manager_id, ll.notes, ll.load_batch_uuid,
               d.first_name AS driver_first_name, d.last_name AS driver_last_name, -- Get from drivers table
               p.product_name, 
               r.route_name, 
               am.username AS area_manager_name -- This is the user who logged it
        FROM loading_logs ll
        JOIN drivers d ON ll.driver_id = d.driver_id -- Corrected join for driver
        JOIN products p ON ll.product_id = p.product_id
        LEFT JOIN delivery_routes r ON ll.route_id = r.route_id
        JOIN users am ON ll.area_manager_id = am.id -- User who created the log
    `; 
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (driver_id) {
        if (!/^\d+$/.test(driver_id)) return res.status(400).json({error: "Invalid driver_id format."});
        conditions.push(`ll.driver_id = $${paramIndex++}`);
        values.push(parseInt(driver_id));
    }

    //SEARCH BY DRIVER NAME
    if (driver_name) {
        conditions.push(`d.first_name ILIKE $${paramIndex++}`);
        values.push(`%${driver_name}%`);
    }

    if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
        }
        conditions.push(`ll.load_timestamp >= (($${paramIndex})::date)::timestamp AT TIME ZONE $${paramIndex + 1}`);
        conditions.push(`ll.load_timestamp < (($${paramIndex}::date + INTERVAL '1 day')::timestamp AT TIME ZONE $${paramIndex + 1})`);
        values.push(date); 
        values.push(TARGET_TIMEZONE); 
        paramIndex += 2;
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY ll.load_timestamp DESC, ll.load_batch_uuid DESC, ll.loading_log_id ASC;"; 

    try {
        const result = await query(sql, values);
        // Combine first_name and last_name for driver_name before sending
        const logsWithFullName = result.rows.map(log => ({
            ...log,
            driver_name: `${log.driver_first_name} ${log.driver_last_name || ''}`.trim()
        }));
        res.json(logsWithFullName); 
    } catch (err) {
        handleError(res, err, "Failed to retrieve loading logs");
    }
};

// === PUT /api/sales-ops/loading-logs/batch/:batchUUID - Edit an entire loading log batch ===
exports.updateLoadingLogBatch = async (req, res) => {
    const { batchUUID } = req.params;
    const { driver_id, route_id, load_type, load_timestamp, notes, items } = req.body;
    const area_manager_id = req.user.id;

    console.log(`[SalesOps API] PUT /loading-logs/batch/${batchUUID} - User: ${area_manager_id}`);

    // --- Enhanced Validations ---
    // UUID validation with better error handling
    if (!batchUUID || typeof batchUUID !== 'string') {
        return res.status(400).json({ error: 'Batch UUID is required and must be a valid string.' });
    }

    // Use the imported uuid validate function or regex fallback
    const isValidUUID = typeof uuidValidate === 'function' ? uuidValidate(batchUUID) : uuidValidateRegex(batchUUID);
    
    if (!isValidUUID) {
        console.error(`[SalesOps API] Invalid UUID format: ${batchUUID}`);
        return res.status(400).json({ 
            error: 'Invalid Batch UUID format. Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            received: batchUUID 
        });
    }

    if (!driver_id || isNaN(parseInt(driver_id))) {
        return res.status(400).json({ error: 'Valid Driver ID is required.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one product item is required.' });
    }

    // Validate load_timestamp
    const finalLoadTimestamp = load_timestamp ? new Date(load_timestamp) : new Date();
    if (isNaN(finalLoadTimestamp.getTime())) {
        return res.status(400).json({ error: 'Invalid load_timestamp format. Please provide a valid date.' });
    }

    // Validate each item
    for (const [index, item] of items.entries()) {
        if (!item.product_id || isNaN(parseInt(item.product_id))) {
            return res.status(400).json({ error: `Item ${index + 1}: Product ID must be a valid integer.` });
        }
        if (item.quantity_loaded === undefined || isNaN(parseFloat(item.quantity_loaded)) || parseFloat(item.quantity_loaded) <= 0) {
            return res.status(400).json({ error: `Item ${index + 1}: Quantity Loaded must be a positive number.` });
        }
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');
        console.log(`[SalesOps API] Transaction BEGIN for batch UUID: ${batchUUID}`);

        // Check if the batch exists before attempting to delete
        const existingBatchCheck = await client.query(
            'SELECT COUNT(*) as count FROM loading_logs WHERE load_batch_uuid = $1', 
            [batchUUID]
        );
        
        const batchExists = parseInt(existingBatchCheck.rows[0].count) > 0;
        console.log(`[SalesOps API] Batch ${batchUUID} exists: ${batchExists}`);

        if (!batchExists) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                error: `Loading log batch with UUID ${batchUUID} not found. Cannot edit non-existent batch.`,
                batch_uuid: batchUUID
            });
        }

        // Validate that the driver exists
        const driverCheck = await client.query(
            'SELECT driver_id, first_name, last_name FROM drivers WHERE driver_id = $1 AND is_active = true', 
            [parseInt(driver_id)]
        );
        
        if (driverCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Driver with ID ${driver_id} not found or is inactive.` });
        }

        // Validate route if provided
        if (route_id && route_id !== null) {
            const routeCheck = await client.query(
                'SELECT route_id FROM delivery_routes WHERE route_id = $1', 
                [parseInt(route_id)]
            );
            
            if (routeCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Route with ID ${route_id} not found.` });
            }
        }

        // Validate all products exist
        const productIds = items.map(item => parseInt(item.product_id));
        const productCheck = await client.query(
            'SELECT product_id FROM products WHERE product_id = ANY($1)', 
            [productIds]
        );
        
        const existingProductIds = productCheck.rows.map(row => row.product_id);
        const missingProducts = productIds.filter(id => !existingProductIds.includes(id));
        
        if (missingProducts.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: `The following product IDs were not found: ${missingProducts.join(', ')}` 
            });
        }

        // Delete existing logs for this batchUUID
        const deleteResult = await client.query(
            'DELETE FROM loading_logs WHERE load_batch_uuid = $1 RETURNING loading_log_id', 
            [batchUUID]
        );
        
        console.log(`[SalesOps API] Deleted ${deleteResult.rowCount} existing logs for batch ${batchUUID}`);

        // Insert new logs with the updated data and the same batchUUID
        const insertPromises = items.map(item => {
            const sql = `
                INSERT INTO loading_logs 
                (driver_id, route_id, product_id, quantity_loaded, load_type, load_timestamp, area_manager_id, notes, load_batch_uuid)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING loading_log_id, product_id, quantity_loaded; 
            `;
            const values = [
                parseInt(driver_id),
                route_id ? parseInt(route_id) : null,
                parseInt(item.product_id),
                parseFloat(item.quantity_loaded),
                load_type || 'initial',
                finalLoadTimestamp,
                area_manager_id,
                notes || null,
                batchUUID 
            ];
            return client.query(sql, values);
        });

        const results = await Promise.all(insertPromises);
        const updatedLogs = results.map(result => result.rows[0]);
        
        // Get additional info for response
        const driverInfo = driverCheck.rows[0];
        const driverName = `${driverInfo.first_name} ${driverInfo.last_name || ''}`.trim();
        
        let routeName = null;
        if (route_id) {
            const routeInfo = await client.query(
                'SELECT route_name FROM delivery_routes WHERE route_id = $1', 
                [parseInt(route_id)]
            );
            routeName = routeInfo.rows[0]?.route_name || null;
        }

        const managerInfo = await client.query(
            'SELECT username FROM users WHERE id = $1', 
            [area_manager_id]
        );
        const managerName = managerInfo.rows[0]?.username || null;

        await client.query('COMMIT');
        console.log(`[SalesOps API] Transaction COMMIT. Batch ${batchUUID} updated with ${updatedLogs.length} logs.`);
        
        res.status(200).json({
            success: true,
            message: `Successfully updated batch ${batchUUID}`,
            batch_uuid: batchUUID,
            driver_id: parseInt(driver_id),
            driver_name: driverName,
            route_id: route_id ? parseInt(route_id) : null,
            route_name: routeName,
            area_manager_name: managerName,
            load_type: load_type || 'initial',
            load_timestamp: finalLoadTimestamp,
            notes: notes || null,
            items: updatedLogs,
            items_count: updatedLogs.length
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[SalesOps API] Transaction ROLLBACK for batch loading log update. Error: ${err.message}`);
        
        // Provide more specific error messages
        if (err.code === '23503') {
            return res.status(400).json({ 
                error: 'Foreign key constraint violation. One or more referenced IDs (driver, route, product, or user) are invalid.',
                details: err.detail || err.message
            });
        }
        
        if (err.code === '23505') {
            return res.status(409).json({ 
                error: 'Duplicate entry conflict.',
                details: err.detail || err.message
            });
        }
        
        handleError(res, err, "Failed to update loading log batch");
    } finally {
        client.release();
    }
};

// === DRIVER DAILY SUMMARIES ===
// POST /api/sales-ops/driver-daily-summaries
exports.createDriverDailySummary = async (req, res) => {
    const { driver_id, route_id, sale_date } = req.body;
    const area_manager_id = req.user.id;

    console.log(`[SalesOps API] POST /driver-daily-summaries - User: ${area_manager_id}, Driver: ${driver_id}, Date: ${sale_date}`);

    if (!driver_id || !sale_date) {
        return res.status(400).json({ error: 'Driver ID and Sale Date are required.' });
    }
    if (isNaN(parseInt(driver_id))) {
        return res.status(400).json({ error: 'Invalid Driver ID.' });
    }
    if (route_id && isNaN(parseInt(route_id))) {
        return res.status(400).json({ error: 'Invalid Route ID.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sale_date)) {
        return res.status(400).json({ error: 'Invalid Sale Date format. Use YYYY-MM-DD.' });
    }

    try {
        const sql = `
            INSERT INTO driver_daily_summaries
            (driver_id, route_id, sale_date, area_manager_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const values = [
            parseInt(driver_id),
            route_id ? parseInt(route_id) : null,
            sale_date,
            area_manager_id
        ];
        const result = await query(sql, values);

        const newSummary = result.rows[0];
        if (newSummary) {
            const driverResult = await query('SELECT first_name FROM drivers WHERE driver_id = $1', [newSummary.driver_id]);
            newSummary.driver_name = driverResult.rows[0]?.first_name || null;
        }

        res.status(201).json(newSummary);
    } catch (err) {
        if (err.code === '23505' && err.constraint === 'driver_daily_summaries_driver_id_sale_date_key') {
            return handleError(res, err, 'A daily summary already exists for this driver on this date.', 409);
        }
        if (err.code === '23503') { 
             if (err.constraint && err.constraint.includes('driver_id')) {
                return handleError(res, err, 'Invalid Driver ID provided.', 400);
            }
            if (err.constraint && err.constraint.includes('route_id')) {
                return handleError(res, err, 'Invalid Route ID provided.', 400);
            }
        }
        handleError(res, err, "Failed to create driver daily summary");
    }
};

// GET /api/sales-ops/driver-daily-summaries?driver_id=X&sale_date=YYYY-MM-DD
// GET /api/sales-ops/driver-daily-summaries?sale_date=YYYY-MM-DD&reconciliation_status=Pending
exports.getDriverDailySummaries = async (req, res) => {
    const { driver_id, sale_date, reconciliation_status, summary_id } = req.query;
    const requesting_user_id = req.user.id;

    console.log(`[SalesOps API] GET /driver-daily-summaries - User: ${requesting_user_id}, Query: ${JSON.stringify(req.query)}`);

    let sql = `
        SELECT dds.*, 
               d.first_name AS driver_name,
               r.route_name, 
               u_am.username AS area_manager_name
        FROM driver_daily_summaries dds
        JOIN drivers d ON dds.driver_id = d.driver_id
        LEFT JOIN delivery_routes r ON dds.route_id = r.route_id
        JOIN users u_am ON dds.area_manager_id = u_am.id
    `;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // --- FIX: Added the missing logic to handle the summary_id parameter ---
    if (summary_id) {
        if (!/^\d+$/.test(summary_id)) return res.status(400).json({error: "Invalid summary_id format."});
        conditions.push(`dds.summary_id = $${paramIndex++}`);
        values.push(parseInt(summary_id));
    }
    // --- END OF FIX ---

    if (driver_id) {
        if (!/^\d+$/.test(driver_id)) return res.status(400).json({error: "Invalid driver_id format."});
        conditions.push(`dds.driver_id = $${paramIndex++}`);
        values.push(parseInt(driver_id));
    }
    if (sale_date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(sale_date)) {
            return res.status(400).json({ error: 'Invalid sale_date format. Use YYYY-MM-DD.' });
        }
        conditions.push(`dds.sale_date = $${paramIndex++}`);
        values.push(sale_date);
    }
    if (reconciliation_status) {
        conditions.push(`dds.reconciliation_status = $${paramIndex++}`);
        values.push(reconciliation_status);
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY dds.sale_date DESC, d.first_name ASC;";

    try {
        const result = await query(sql, values);
        const summariesWithFullName = result.rows.map(summary => ({
            ...summary,
            name: summary.driver_name 
        }));
        if (summariesWithFullName.length === 0 && (summary_id || (driver_id && sale_date))) {
            return res.status(404).json({ message: "Driver daily summary not found for the specified driver and date." });
        }
        res.json(summariesWithFullName);
    } catch (err) {
        handleError(res, err, "Failed to retrieve driver daily summaries");
    }
};

// PUT /api/sales-ops/driver-daily-summaries/:summaryId - Update a summary
exports.updateDriverDailySummary = async (req, res) => {
    const summaryId = parseInt(req.params.summaryId);
    const { route_id } = req.body;
    const last_updated_by_user_id = req.user.id;

    if (isNaN(summaryId)) {
        return res.status(400).json({ error: 'Invalid Summary ID.' });
    }
    // This validation can be simplified as we only expect route_id
    if (route_id !== undefined && route_id !== null && isNaN(parseInt(route_id))) {
        return res.status(400).json({ error: 'Invalid Route ID provided.' });
    }

    try {
        const updateQuery = `
            UPDATE driver_daily_summaries 
            SET route_id = $1, last_updated_by_user_id = $2, updated_at = NOW()
            WHERE summary_id = $3;
        `;
        const updateValues = [route_id ? parseInt(route_id) : null, last_updated_by_user_id, summaryId];
        
        const updateResult = await query(updateQuery, updateValues);

        if (updateResult.rowCount === 0) {
            return res.status(404).json({ error: 'Daily summary not found.' });
        }

        // --- NEW: Re-fetch the full, joined data after the update ---
        const selectQuery = `
            SELECT dds.*, 
                   d.first_name AS driver_name,
                   r.route_name, 
                   u_am.username AS area_manager_name
            FROM driver_daily_summaries dds
            JOIN drivers d ON dds.driver_id = d.driver_id
            LEFT JOIN delivery_routes r ON dds.route_id = r.route_id
            JOIN users u_am ON dds.area_manager_id = u_am.id
            WHERE dds.summary_id = $1;
        `;
        const finalResult = await query(selectQuery, [summaryId]);
        
        // Return the complete object to the frontend
        res.json(finalResult.rows[0]);

    } catch (err) {
        handleError(res, err, "Failed to update driver daily summary");
    }
};

// PUT /api/sales-ops/driver-daily-summaries/:summaryId/reconcile
exports.reconcileDriverDailySummary = async (req, res) => {
    const summaryId = parseInt(req.params.summaryId);
    const { total_cash_collected_from_driver, reconciliation_status, reconciliation_notes } = req.body;
    const area_manager_id = req.user.id;

    console.log(`[SalesOps API] PUT /driver-daily-summaries/${summaryId}/reconcile - User: ${area_manager_id}`);

    if (isNaN(summaryId)) {
        return res.status(400).json({ error: 'Invalid Summary ID.' });
    }
    if (total_cash_collected_from_driver === undefined || isNaN(parseFloat(total_cash_collected_from_driver))) {
        return res.status(400).json({ error: 'Total cash collected from driver is required and must be a number.' });
    }
    if (!reconciliation_status || !['Reconciled', 'Cash Short', 'Cash Over', 'Pending Adjustment', 'Pending'].includes(reconciliation_status)) {
        return res.status(400).json({ error: 'Invalid reconciliation status.' });
    }
    
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const summaryCheck = await client.query('SELECT summary_id FROM driver_daily_summaries WHERE summary_id = $1 FOR UPDATE', [summaryId]);
        if (summaryCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Daily summary not found.' });
        }

        const updatedSummaryAfterTotals = await updateDriverDailySummaryTotals(client, summaryId);
        if (!updatedSummaryAfterTotals) {
            await client.query('ROLLBACK');
            return handleError(res, new Error("Failed to recalculate summary totals before reconciliation."), "Reconciliation error");
        }

        const finalUpdateSql = `
            UPDATE driver_daily_summaries SET
                total_cash_collected_from_driver = $1,
                reconciliation_status = $2,
                reconciliation_notes = $3,
                area_manager_id = $4, 
                updated_at = CURRENT_TIMESTAMP
            WHERE summary_id = $5
            RETURNING *;
        `;
        const finalUpdateValues = [
            parseFloat(total_cash_collected_from_driver),
            reconciliation_status,
            reconciliation_notes || null,
            area_manager_id, 
            summaryId
        ];

        const result = await client.query(finalUpdateSql, finalUpdateValues);
        
        await client.query('COMMIT');
        res.json(result.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, "Failed to reconcile driver daily summary");
    } finally {
        client.release();
    }
};

// === DRIVER SALES & SALE ITEMS ===
// POST /api/sales-ops/driver-sales
exports.createDriverSale = async (req, res) => {
    const {
        driver_daily_summary_id,
        customer_id,
        customer_name_override,
        payment_type,
        notes,
        sale_items 
    } = req.body;
    const area_manager_logged_by_id = req.user.id;

    console.log(`[SalesOps API] POST /driver-sales for summary_id: ${driver_daily_summary_id} - User: ${area_manager_logged_by_id}`);

    // --- Validations ---
    if (!driver_daily_summary_id || isNaN(parseInt(driver_daily_summary_id))) {
        return res.status(400).json({ error: 'Valid Driver Daily Summary ID is required.' });
    }
    if (customer_id && isNaN(parseInt(customer_id))) {
        return res.status(400).json({ error: 'Invalid Customer ID.' });
    }
    if (!payment_type || !['Cash', 'Credit', 'Debit'].includes(payment_type)) {
        return res.status(400).json({ error: 'Valid Payment Type (Cash, Credit, Debit) is required.' });
    }
    if (!Array.isArray(sale_items) || sale_items.length === 0) {
        return res.status(400).json({ error: 'At least one sale item is required.' });
    }
    for (const item of sale_items) {
        if (!item.product_id || isNaN(parseInt(item.product_id)) ||
            item.quantity_sold === undefined || isNaN(parseFloat(item.quantity_sold)) || parseFloat(item.quantity_sold) <= 0 ||
            item.unit_price === undefined || isNaN(parseFloat(item.unit_price)) || parseFloat(item.unit_price) < 0) {
            return res.status(400).json({ error: 'Each sale item must have valid Product ID, positive Quantity Sold, and non-negative Unit Price.' });
        }
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        const summaryCheck = await client.query('SELECT reconciliation_status FROM driver_daily_summaries WHERE summary_id = $1 FOR UPDATE', [parseInt(driver_daily_summary_id)]);
        if (summaryCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Driver daily summary not found.' });
        }
        if (summaryCheck.rows[0].reconciliation_status === 'Reconciled' && !['admin', 'manager'].includes(req.user.role)) {
           await client.query('ROLLBACK');
           return res.status(403).json({ error: 'Cannot add sales to an already reconciled summary. Contact manager/admin for adjustments.' });
        }


        const total_sale_amount = sale_items.reduce((sum, item) => {
            return sum + (parseFloat(item.quantity_sold) * parseFloat(item.unit_price));
        }, 0);

        const driverSaleSql = `
            INSERT INTO driver_sales
            (driver_daily_summary_id, customer_id, customer_name_override, payment_type, total_sale_amount, area_manager_logged_by_id, notes, sale_timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            RETURNING sale_id, created_at AS sale_timestamp; 
        `;
        const driverSaleValues = [
            parseInt(driver_daily_summary_id),
            customer_id ? parseInt(customer_id) : null,
            customer_name_override || null,
            payment_type,
            total_sale_amount,
            area_manager_logged_by_id,
            notes || null
        ];
        const driverSaleResult = await client.query(driverSaleSql, driverSaleValues);
        const newSaleId = driverSaleResult.rows[0].sale_id;
        const actualSaleTimestamp = driverSaleResult.rows[0].sale_timestamp;

        const itemInsertPromises = sale_items.map(item => {
            const itemSql = `
                INSERT INTO driver_sale_items
                (driver_sale_id, product_id, quantity_sold, unit_price) 
                VALUES ($1, $2, $3, $4); 
            `;
            return client.query(itemSql, [newSaleId, parseInt(item.product_id), parseFloat(item.quantity_sold), parseFloat(item.unit_price)]);
        });
        await Promise.all(itemInsertPromises);

        await updateDriverDailySummaryTotals(client, parseInt(driver_daily_summary_id));
        
        await client.query('COMMIT');

        const createdSaleQuery = `
            SELECT ds.*, 
                   c.customer_name AS actual_customer_name, 
                   u.username AS logged_by_username
            FROM driver_sales ds
            LEFT JOIN customers c ON ds.customer_id = c.customer_id
            JOIN users u ON ds.area_manager_logged_by_id = u.id
            WHERE ds.sale_id = $1;
        `;
        const saleDetailsResult = await query(createdSaleQuery, [newSaleId]); 
        const finalSaleData = saleDetailsResult.rows[0];
        finalSaleData.sale_timestamp = actualSaleTimestamp; 

        const itemsResult = await query('SELECT dsi.*, p.product_name FROM driver_sale_items dsi JOIN products p ON dsi.product_id = p.product_id WHERE dsi.driver_sale_id = $1 ORDER BY dsi.item_id ASC', [newSaleId]);
        finalSaleData.sale_items = itemsResult.rows;

        res.status(201).json(finalSaleData);

    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23503') { 
             if (err.constraint && err.constraint.includes('driver_daily_summary_id')) {
                return handleError(res, err, 'Invalid Driver Daily Summary ID provided.', 400);
            }
            if (err.constraint && err.constraint.includes('customer_id')) {
                return handleError(res, err, 'Invalid Customer ID provided.', 400);
            }
             if (err.constraint && err.constraint.includes('product_id')) {
                return handleError(res, err, 'Invalid Product ID in sale items.', 400);
            }
        }
        handleError(res, err, "Failed to create driver sale");
    } finally {
        client.release();
    }
};

// GET /api/sales-ops/driver-sales?driver_daily_summary_id=X
exports.getDriverSales = async (req, res) => {
    const { driver_daily_summary_id } = req.query;
    const requesting_user_id = req.user.id;

    console.log(`[SalesOps API] GET /driver-sales for summary_id: ${driver_daily_summary_id} - User: ${requesting_user_id}`);

    if (!driver_daily_summary_id || isNaN(parseInt(driver_daily_summary_id))) {
        return res.status(400).json({ error: 'Valid Driver Daily Summary ID is required.' });
    }

    try {
        const salesSql = `
            SELECT ds.*, 
                   c.customer_name AS actual_customer_name, 
                   u.username AS logged_by_username
            FROM driver_sales ds
            LEFT JOIN customers c ON ds.customer_id = c.customer_id
            JOIN users u ON ds.area_manager_logged_by_id = u.id
            WHERE ds.driver_daily_summary_id = $1
            ORDER BY ds.sale_timestamp DESC, ds.sale_id DESC;
        `;
        const salesResult = await query(salesSql, [parseInt(driver_daily_summary_id)]);
        const sales = salesResult.rows;

        if (sales.length > 0) {
            const saleIds = sales.map(s => s.sale_id);
            const itemsSql = `
                SELECT dsi.*, p.product_name
                FROM driver_sale_items dsi
                JOIN products p ON dsi.product_id = p.product_id
                WHERE dsi.driver_sale_id = ANY($1::int[]) 
                ORDER BY dsi.item_id ASC; 
            `; 
            const itemsResult = await query(itemsSql, [saleIds]);
            const itemsBySaleId = itemsResult.rows.reduce((acc, item) => {
                (acc[item.driver_sale_id] = acc[item.driver_sale_id] || []).push(item);
                return acc;
            }, {});

            sales.forEach(sale => {
                sale.sale_items = itemsBySaleId[sale.sale_id] || [];
            });
        }
        res.json(sales);
    } catch (err) {
        handleError(res, err, "Failed to retrieve driver sales");
    }
};

// PUT /api/sales-ops/driver-sales/:saleId
exports.updateDriverSale = async (req, res) => {
    const saleId = parseInt(req.params.saleId);
    const {
        customer_id,
        customer_name_override,
        payment_type,
        notes,
        sale_items 
    } = req.body;
    const area_manager_logged_by_id = req.user.id;

    console.log(`[SalesOps API] PUT /driver-sales/${saleId} - User: ${area_manager_logged_by_id}`);

    // --- Validations ---
    if (isNaN(saleId)) {
        return res.status(400).json({ error: 'Invalid Sale ID.' });
    }
    if (customer_id && isNaN(parseInt(customer_id))) {
        return res.status(400).json({ error: 'Invalid Customer ID.' });
    }
    if (payment_type && !['Cash', 'Credit', 'Debit'].includes(payment_type)) {
        return res.status(400).json({ error: 'Invalid Payment Type.' });
    }
    if (sale_items !== undefined) { // Items are optional for update, only update if provided
        if (!Array.isArray(sale_items) || sale_items.length === 0) {
            return res.status(400).json({ error: 'If sale_items are provided for update, it must be a non-empty array.' });
        }
        for (const item of sale_items) {
            if (!item.product_id || isNaN(parseInt(item.product_id)) ||
                item.quantity_sold === undefined || isNaN(parseFloat(item.quantity_sold)) || parseFloat(item.quantity_sold) <= 0 ||
                item.unit_price === undefined || isNaN(parseFloat(item.unit_price)) || parseFloat(item.unit_price) < 0) {
                return res.status(400).json({ error: 'Each updated sale item must have valid Product ID, positive Quantity Sold, and non-negative Unit Price.' });
            }
        }
    }


    const client = await getClient();
    try {
        await client.query('BEGIN');

        const saleCheckResult = await client.query('SELECT driver_daily_summary_id, reconciliation_status FROM driver_sales ds JOIN driver_daily_summaries dds ON ds.driver_daily_summary_id = dds.summary_id WHERE sale_id = $1 FOR UPDATE', [saleId]);
        if (saleCheckResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Sale not found.' });
        }
        const driverDailySummaryId = saleCheckResult.rows[0].driver_daily_summary_id;
        const currentReconciliationStatus = saleCheckResult.rows[0].reconciliation_status;

        if (currentReconciliationStatus === 'Reconciled' && !['admin', 'manager'].includes(req.user.role)) {
           await client.query('ROLLBACK');
           return res.status(403).json({ error: 'Cannot edit sales within an already reconciled summary. Contact manager/admin for adjustments.' });
        }


        // --- Update main sale details ---
        const updateFields = [];
        const updateValues = [];
        let paramIdx = 1;

        // Only add fields to update if they are present in the request body
        if (customer_id !== undefined) { updateFields.push(`customer_id = $${paramIdx++}`); updateValues.push(customer_id ? parseInt(customer_id) : null); }
        if (customer_name_override !== undefined) { updateFields.push(`customer_name_override = $${paramIdx++}`); updateValues.push(customer_name_override || null); }
        if (payment_type !== undefined) { updateFields.push(`payment_type = $${paramIdx++}`); updateValues.push(payment_type); }
        if (notes !== undefined) { updateFields.push(`notes = $${paramIdx++}`); updateValues.push(notes || null); }
        
        let newTotalSaleAmount;
        if (sale_items !== undefined) { 
            newTotalSaleAmount = sale_items.reduce((sum, item) => sum + (parseFloat(item.quantity_sold) * parseFloat(item.unit_price)), 0);
            updateFields.push(`total_sale_amount = $${paramIdx++}`);
            updateValues.push(newTotalSaleAmount);
        }
        
        // Always update who logged it and the timestamp if any other field is updated
        if (updateFields.length > 0 || sale_items !== undefined) { // Ensure some update is happening
            updateFields.push(`area_manager_logged_by_id = $${paramIdx++}`); updateValues.push(area_manager_logged_by_id);
            updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        
            updateValues.push(saleId);
            const updateSaleSql = `UPDATE driver_sales SET ${updateFields.join(', ')} WHERE sale_id = $${paramIdx} RETURNING *;`;
            await client.query(updateSaleSql, updateValues);
        }


        // --- Replace sale items if provided ---
        if (sale_items !== undefined) {
            await client.query('DELETE FROM driver_sale_items WHERE driver_sale_id = $1', [saleId]);
            const itemInsertPromises = sale_items.map(item => {
                const itemSql = `
                    INSERT INTO driver_sale_items (driver_sale_id, product_id, quantity_sold, unit_price)
                    VALUES ($1, $2, $3, $4);`;
                return client.query(itemSql, [saleId, parseInt(item.product_id), parseFloat(item.quantity_sold), parseFloat(item.unit_price)]);
            });
            await Promise.all(itemInsertPromises);
        }

        // Update the parent driver_daily_summary totals
        await updateDriverDailySummaryTotals(client, driverDailySummaryId);

        await client.query('COMMIT');

        // Fetch the complete updated sale with items to return to client
        const updatedSaleQuery = `
            SELECT ds.*, c.customer_name AS actual_customer_name, u.username AS logged_by_username
            FROM driver_sales ds
            LEFT JOIN customers c ON ds.customer_id = c.customer_id
            JOIN users u ON ds.area_manager_logged_by_id = u.id
            WHERE ds.sale_id = $1;
        `;
        const saleDetailsResult = await query(updatedSaleQuery, [saleId]);
        const finalSaleData = saleDetailsResult.rows[0];

        // Fetch items again to ensure they are fresh, especially if not updated
        const itemsResultAfterUpdate = await query('SELECT dsi.*, p.product_name FROM driver_sale_items dsi JOIN products p ON dsi.product_id = p.product_id WHERE dsi.driver_sale_id = $1 ORDER BY dsi.item_id ASC', [saleId]);
        finalSaleData.sale_items = itemsResultAfterUpdate.rows;
        
        res.json(finalSaleData);

    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, "Failed to update driver sale");
    } finally {
        client.release();
    }
};

// DELETE /api/sales-ops/driver-sales/:saleId
exports.deleteDriverSale = async (req, res) => {
    const saleId = parseInt(req.params.saleId);
    const area_manager_logged_by_id = req.user.id; 

    console.log(`[SalesOps API] DELETE /driver-sales/${saleId} - User: ${area_manager_logged_by_id}`);

    if (isNaN(saleId)) {
        return res.status(400).json({ error: 'Invalid Sale ID.' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        const saleDataResult = await client.query('SELECT driver_daily_summary_id, reconciliation_status FROM driver_sales ds JOIN driver_daily_summaries dds ON ds.driver_daily_summary_id = dds.summary_id WHERE sale_id = $1 FOR UPDATE', [saleId]);
        if (saleDataResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Sale not found.' });
        }
        const driverDailySummaryId = saleDataResult.rows[0].driver_daily_summary_id;
        const currentReconciliationStatus = saleDataResult.rows[0].reconciliation_status;

        if (currentReconciliationStatus === 'Reconciled' && !['admin', 'manager'].includes(req.user.role)) {
           await client.query('ROLLBACK');
           return res.status(403).json({ error: 'Cannot delete sales from an already reconciled summary. Contact manager/admin for adjustments.' });
        }

        await client.query('DELETE FROM driver_sale_items WHERE driver_sale_id = $1', [saleId]);
        const deleteSaleResult = await client.query('DELETE FROM driver_sales WHERE sale_id = $1', [saleId]);

        if (deleteSaleResult.rowCount === 0) {
            await client.query('ROLLBACK'); // Should not happen if FOR UPDATE found it
            return res.status(404).json({ error: 'Sale not found during delete operation.' });
        }
        
        await updateDriverDailySummaryTotals(client, driverDailySummaryId);
        await client.query('COMMIT');
        res.status(200).json({ message: `Sale ID ${saleId} and its items deleted successfully.` });

    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, "Failed to delete driver sale");
    } finally {
        client.release();
    }
};

// === PRODUCT RETURNS ===
exports.getLossReasons = async (req, res) => {
    try {
        const result = await query('SELECT loss_reason_id, reason_description FROM loss_reasons WHERE is_active = TRUE ORDER BY loss_reason_id');
        res.json(result.rows);
    } catch (err) {
        handleError(res, err, "Failed to retrieve loss reasons");
    }
};

exports.createProductReturns = async (req, res) => {
    const { driver_id, return_date, items, driver_daily_summary_id } = req.body;
    const area_manager_id = req.user.id; 

    console.log(`[SalesOps API] POST /product-returns (batch) - User: ${area_manager_id}, Driver: ${driver_id}`);

    // --- Re-enabled and corrected validation ---
    if (!driver_id || isNaN(parseInt(driver_id))) {
        return res.status(400).json({ error: 'Valid Driver ID is required.' });
    }
    if (!return_date || !/^\d{4}-\d{2}-\d{2}$/.test(return_date)) {
        return res.status(400).json({ error: 'Valid Return Date (YYYY-MM-DD) is required.' });
    }
    if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Items must be an array.' });
    }
    
    const client = await getClient();
    try {
        await client.query('BEGIN');

        // This makes the "Save" action a complete replacement of the day's returns, which is simpler to manage.
        await client.query('DELETE FROM product_returns WHERE driver_id = $1 AND return_date = $2', [parseInt(driver_id), return_date]);
        
        const itemsToLog = items.filter(item => parseFloat(item.quantity_returned) > 0);

        if (itemsToLog.length > 0) {
            // FIX: Define insertPromises outside the map so it's always available
            const insertPromises = itemsToLog.map(item => {
                // FIX: SQL statement now includes the loss_reason_id column
                const sql = `
                    INSERT INTO product_returns
                    (driver_id, return_date, product_id, quantity_returned, loss_reason_id, custom_reason_for_loss, area_manager_id, notes, driver_daily_summary_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING *;
                `;

                // FIX: Logic to handle which reason field gets populated
                const reasonId = item.loss_reason_id ? parseInt(item.loss_reason_id) : null;
                const customReason = item.loss_reason_id ? null : item.custom_reason_for_loss;

                const values = [
                    parseInt(driver_id),
                    return_date,
                    parseInt(item.product_id),
                    parseFloat(item.quantity_returned),
                    reasonId,
                    customReason,
                    area_manager_id,
                    item.notes ? item.notes.trim() : null,
                    driver_daily_summary_id ? parseInt(driver_daily_summary_id) : null
                ];
                return client.query(sql, values);
            });

            await Promise.all(insertPromises);
        }
        
        await client.query('COMMIT');
        // FIX: The response now correctly informs the user what was saved.
        res.status(201).json({ message: `Successfully saved ${itemsToLog.length} return entries.` });

    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23503') {
            return handleError(res, err, 'Invalid Driver ID or Product ID provided.', 400);
        }
        handleError(res, err, "Failed to log product returns");
    } finally {
        client.release();
    }
};

// GET /api/sales-ops/product-returns?driver_id=X&date=YYYY-MM-DD
exports.getProductReturns = async (req, res) => {
    const { driver_id, date, product_id } = req.query; 
    const requesting_user_id = req.user.id;

    console.log(`[SalesOps API] GET /product-returns - User: ${requesting_user_id}, Query: ${JSON.stringify(req.query)}`);

    let sql = `
        SELECT pr.*, 
               d.first_name AS driver_first_name, d.last_name AS driver_last_name,
               p.product_name, 
               COALESCE(lr.reason_description, pr.custom_reason_for_loss) AS loss_reason_text, 
               u_am.username AS area_manager_name
        FROM product_returns pr
        JOIN drivers d ON pr.driver_id = d.driver_id
        JOIN products p ON pr.product_id = p.product_id
        LEFT JOIN loss_reasons lr ON pr.loss_reason_id = lr.loss_reason_id
        JOIN users u_am ON pr.area_manager_id = u_am.id
    `; 
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (driver_id) {
        if (!/^\d+$/.test(driver_id)) return res.status(400).json({error: "Invalid driver_id format."});
        conditions.push(`pr.driver_id = $${paramIndex++}`);
        values.push(parseInt(driver_id));
    }
    if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
        }
        conditions.push(`pr.return_date = $${paramIndex++}`);
        values.push(date);
    }
    if (product_id) {
        if (!/^\d+$/.test(product_id)) return res.status(400).json({error: "Invalid product_id format."});
        conditions.push(`pr.product_id = $${paramIndex++}`);
        values.push(parseInt(product_id));
    }
   
    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY pr.return_date DESC, pr.created_at DESC;";

    try {
        const result = await query(sql, values);
        const logsWithFullName = result.rows.map(log => ({
            ...log,
            driver_name: `${log.driver_first_name} ${log.driver_last_name || ''}`.trim()
        }));
        res.json(logsWithFullName);
    } catch (err) {
        handleError(res, err, "Failed to retrieve product returns");
    }
};

// === PACKAGING LOGS & TYPES ===
exports.getPackagingTypes = async (req, res) => {
    console.log(`[SalesOps API] GET /packaging-types - User: ${req.user.id}`);
    try {
        const result = await query('SELECT packaging_type_id, type_name, description FROM packaging_types WHERE is_active = TRUE ORDER BY type_name ASC');
        res.json(result.rows);
    } catch (err) {
        handleError(res, err, "Failed to retrieve packaging types");
    }
};

exports.createPackagingLog = async (req, res) => {
    const {
        driver_id,
        driver_daily_summary_id, 
        log_date,
        packaging_type_id,
        quantity_out,
        quantity_returned,
        shrinkage_override, 
        notes
    } = req.body;
    const area_manager_id = req.user.id;

    console.log(`[SalesOps API] POST /packaging-logs - User: ${area_manager_id}, Driver: ${driver_id}`);

    if (!driver_id || isNaN(parseInt(driver_id))) {
        return res.status(400).json({ error: 'Valid Driver ID is required.' });
    }
    if (!log_date || !/^\d{4}-\d{2}-\d{2}$/.test(log_date)) {
        return res.status(400).json({ error: 'Valid Log Date (YYYY-MM-DD) is required.' });
    }
    if (!packaging_type_id || isNaN(parseInt(packaging_type_id))) {
        return res.status(400).json({ error: 'Valid Packaging Type ID is required.' });
    }
    if (quantity_out !== undefined && quantity_out !== null && (isNaN(parseFloat(quantity_out)) || parseFloat(quantity_out) < 0)) {
        return res.status(400).json({ error: 'Quantity Out must be a non-negative number if provided.' });
    }
    if (quantity_returned !== undefined && quantity_returned !== null && (isNaN(parseFloat(quantity_returned)) || parseFloat(quantity_returned) < 0)) {
        return res.status(400).json({ error: 'Quantity Returned must be a non-negative number if provided.' });
    }
     if (driver_daily_summary_id && isNaN(parseInt(driver_daily_summary_id))) {
        return res.status(400).json({ error: 'Invalid Driver Daily Summary ID.' });
    }
    if (shrinkage_override !== undefined && shrinkage_override !== null && isNaN(parseFloat(shrinkage_override))) {
        return res.status(400).json({ error: 'Shrinkage Override must be a number if provided.' });
    }

    try {
        const sql = `
            INSERT INTO packaging_logs
            (driver_id, driver_daily_summary_id, log_date, packaging_type_id, quantity_out, quantity_returned, shrinkage_override, area_manager_id, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;
        const values = [
            parseInt(driver_id),
            driver_daily_summary_id ? parseInt(driver_daily_summary_id) : null,
            log_date,
            parseInt(packaging_type_id),
            quantity_out ? parseFloat(quantity_out) : null,
            quantity_returned ? parseFloat(quantity_returned) : null,
            shrinkage_override ? parseFloat(shrinkage_override) : null,
            area_manager_id,
            notes || null
        ];
        const result = await query(sql, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23503') { 
            if (err.constraint && err.constraint.includes('packaging_type_id')) return handleError(res, err, 'Invalid Packaging Type ID.', 400);
            return handleError(res, err, 'Invalid reference ID provided (Driver or Summary).', 400);
        }
        handleError(res, err, "Failed to log packaging data");
    }
};

exports.getPackagingLogs = async (req, res) => {
    const { driver_id, date, packaging_type_id } = req.query;
    const requesting_user_id = req.user.id;

    console.log(`[SalesOps API] GET /packaging-logs - User: ${requesting_user_id}, Query: ${JSON.stringify(req.query)}`);
    
    let sql = `
        SELECT pl.*, 
               d.first_name AS driver_first_name, d.last_name AS driver_last_name,
               pt.type_name AS packaging_type_name,
               u_am.username AS area_manager_name
        FROM packaging_logs pl
        JOIN drivers d ON pl.driver_id = d.driver_id
        JOIN packaging_types pt ON pl.packaging_type_id = pt.packaging_type_id
        JOIN users u_am ON pl.area_manager_id = u_am.id
    `;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (driver_id) {
        if (!/^\d+$/.test(driver_id)) return res.status(400).json({error: "Invalid driver_id format."});
        conditions.push(`pl.driver_id = $${paramIndex++}`);
        values.push(parseInt(driver_id));
    }
    if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
        }
        conditions.push(`pl.log_date = $${paramIndex++}`);
        values.push(date);
    }
    if (packaging_type_id) {
        if (!/^\d+$/.test(packaging_type_id)) return res.status(400).json({error: "Invalid packaging_type_id format."});
        conditions.push(`pl.packaging_type_id = $${paramIndex++}`);
        values.push(parseInt(packaging_type_id));
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY pl.log_date DESC, pl.created_at DESC;";

    try {
        const result = await query(sql, values);
        const logsWithFullName = result.rows.map(log => ({
            ...log,
            driver_name: `${log.driver_first_name} ${log.driver_last_name || ''}`.trim()
        }));
        res.json(logsWithFullName);
    } catch (err) {
        handleError(res, err, "Failed to retrieve packaging logs");
    }
};

module.exports.handleError = handleError;
module.exports.updateDriverDailySummaryTotals = updateDriverDailySummaryTotals;