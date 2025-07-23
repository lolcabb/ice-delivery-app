const { query, getClient, pool } = require('../../db/postgres');

// GET /api/sales-ops/routes/:routeId/customers
// This now correctly joins and orders by the route_sequence
exports.getRouteCustomers = async (req, res, next) => {
    const { routeId } = req.params;
    try {
        const queryText = `
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
        const { rows } = await pool.query(queryText, [routeId]);
        res.json({ customers: rows });
    } catch (err) {
        console.error('Error fetching route customers:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /api/sales-ops/routes/:routeId/customers
// Adds a single customer to a route, placing them at the end of the sequence.
exports.addRouteCustomer = async (req, res, next) => {
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
                [customer_id, routeId, newSequence, req.user.id]
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
exports.removeRouteCustomer = async (req, res, next) => {
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
exports.updateRouteCustomerOrder = async (req, res, next) => {
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
exports.getCustomerPrices = async (req, res, next) => {
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
        next(err);
    }
};

// PUT update customer price
exports.updateCustomerPrice = async (req, res, next) => {
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
        next(err);
    }
};

// Enhanced batch sales save with pricing
exports.batchSalesEntry = async (req, res, next) => {
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
                    item_total = 0;
                } else if (transaction_type === 'Internal Use') {
                    item_total = 0;
                }

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

            await client.query(
                'UPDATE driver_sales SET total_sale_amount = $1 WHERE sale_id = $2',
                [sale_total_amount, sale_id]
            );

            totalSalesAmount += sale_total_amount;

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
        next(err);
    } finally {
        client.release();
    }
};

// GET sales for editing
exports.getDriverSalesForEdit = async (req, res, next) => {
    const summary_id = parseInt(req.params.summary_id);

    if (isNaN(summary_id)) {
        return res.status(400).json({ error: 'Invalid summary ID' });
    }

    try {
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
        next(err);
    }
};

// PUT update individual sale (for corrections)
exports.updateDriverSaleSimple = async (req, res, next) => {
    const sale_id = parseInt(req.params.sale_id);
    const { payment_type, notes, items } = req.body;
    const user_id = req.user.id;

    if (isNaN(sale_id)) {
        return res.status(400).json({ error: 'Invalid sale ID' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

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

        if (Array.isArray(items) && items.length > 0) {
            await client.query('DELETE FROM driver_sale_items WHERE driver_sale_id = $1', [sale_id]);

            const itemInsertPromises = items.map(item => {
                const sql = `
                    INSERT INTO driver_sale_items
                    (driver_sale_id, product_id, quantity_sold, unit_price, transaction_type)
                    VALUES ($1, $2, $3, $4, $5)
                `;
                const values = [
                    sale_id,
                    item.product_id,
                    item.quantity_sold,
                    item.unit_price,
                    item.transaction_type || 'Sale'
                ];
                return client.query(sql, values);
            });
            await Promise.all(itemInsertPromises);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Sale updated successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

exports.deleteDriverSaleSimple = async (req, res, next) => {
    const sale_id = parseInt(req.params.sale_id);

    if (isNaN(sale_id)) {
        return res.status(400).json({ error: 'Invalid sale ID' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        await client.query('DELETE FROM driver_sale_items WHERE driver_sale_id = $1', [sale_id]);
        await client.query('DELETE FROM driver_sales WHERE sale_id = $1', [sale_id]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Sale deleted successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

exports.batchReturns = async (req, res, next) => {
    const { driver_daily_summary_id, returns } = req.body;
    const area_manager_id = req.user.id;

    if (!driver_daily_summary_id || !Array.isArray(returns)) {
        return res.status(400).json({ error: 'Invalid request data.' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        await client.query('DELETE FROM product_returns WHERE driver_daily_summary_id = $1', [driver_daily_summary_id]);

        const insertPromises = returns.map(item => {
            const sql = `
                INSERT INTO product_returns
                (driver_daily_summary_id, product_id, quantity_returned, loss_reason_id, custom_reason_for_loss, area_manager_id)
                VALUES ($1, $2, $3, $4, $5, $6)
            `;
            const values = [
                driver_daily_summary_id,
                item.product_id,
                item.quantity_returned,
                item.loss_reason_id || null,
                item.custom_reason_for_loss || null,
                area_manager_id
            ];
            return client.query(sql, values);
        });

        await Promise.all(insertPromises);
        await client.query('COMMIT');
        res.status(201).json({ message: 'Returns saved successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

exports.getReconciliationSummary = async (req, res, next) => {
    const { driver_id, date } = req.query;

    if (!driver_id || !date) {
        return res.status(400).json({ error: 'Driver ID and Date are required.' });
    }

    try {
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

        const summaryQuery = `
            SELECT
                dds.,
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
        next(err);
    }
};

// === PRODUCTS ===
exports.getProducts = async (req, res, next) => {
    try {
        const result = await query('SELECT product_id, product_name, default_unit_price, unit_of_measure FROM products WHERE is_active = TRUE ORDER BY product_id ASC');
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

