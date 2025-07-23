const { query, getClient, pool } = require('../../db/postgres');

// Helper to update financial totals on driver_daily_summary
const updateDriverDailySummaryTotals = async (client, driverDailySummaryId) => {
    console.log(`[SalesOps Helper] Updating totals for driver_daily_summary_id: ${driverDailySummaryId}`);
    if (!driverDailySummaryId) {
        console.error('[SalesOps Helper] Error: driverDailySummaryId is undefined or null.');
        throw new Error('Cannot update summary totals without a valid driverDailySummaryId.');
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

// === DRIVER DAILY SUMMARIES ===
exports.createDriverDailySummary = async (req, res, next) => {
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
            return next(err);
        }
        if (err.code === '23503') {
             if (err.constraint && err.constraint.includes('driver_id')) return next(err);
             if (err.constraint && err.constraint.includes('route_id')) return next(err);
        }
        next(err);
    }
};

exports.getDriverDailySummaries = async (req, res, next) => {
    const { driver_id, sale_date, reconciliation_status, summary_id } = req.query;
    const requesting_user_id = req.user.id;

    console.log(`[SalesOps API] GET /driver-daily-summaries - User: ${requesting_user_id}, Query: ${JSON.stringify(req.query)}`);

    let sql = `
        SELECT dds.*,\n               d.first_name AS driver_name,\n               r.route_name,\n               u_am.username AS area_manager_name
        FROM driver_daily_summaries dds
        JOIN drivers d ON dds.driver_id = d.driver_id
        LEFT JOIN delivery_routes r ON dds.route_id = r.route_id
        JOIN users u_am ON dds.area_manager_id = u_am.id
    `;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (summary_id) {
        if (!/^\d+$/.test(summary_id)) return res.status(400).json({error: 'Invalid summary_id format.'});
        conditions.push(`dds.summary_id = $${paramIndex++}`);
        values.push(parseInt(summary_id));
    }
    if (driver_id) {
        if (!/^\d+$/.test(driver_id)) return res.status(400).json({error: 'Invalid driver_id format.'});
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
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY dds.sale_date DESC, dds.driver_id ASC, dds.summary_id ASC;';

    try {
        const result = await query(sql, values);
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

exports.updateDriverDailySummary = async (req, res, next) => {
    const summaryId = parseInt(req.params.summaryId);
    const { route_id, reconciliation_status, notes } = req.body;

    if (isNaN(summaryId)) {
        return res.status(400).json({ error: 'Invalid Summary ID' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (route_id) {
            if (isNaN(parseInt(route_id))) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Invalid Route ID' });
            }
            updates.push(`route_id = $${paramIndex++}`);
            values.push(parseInt(route_id));
        }
        if (reconciliation_status) {
            updates.push(`reconciliation_status = $${paramIndex++}`);
            values.push(reconciliation_status);
        }
        if (notes !== undefined) {
            updates.push(`notes = $${paramIndex++}`);
            values.push(notes);
        }

        if (updates.length > 0) {
            values.push(summaryId);
            await client.query(
                `UPDATE driver_daily_summaries
                 SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
                 WHERE summary_id = $${paramIndex}`,
                values
            );
        }

        const updatedSummaryAfterTotals = await updateDriverDailySummaryTotals(client, summaryId);
        await client.query('COMMIT');
        res.status(200).json(updatedSummaryAfterTotals);
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

exports.reconcileDriverDailySummary = async (req, res, next) => {
    const summaryId = parseInt(req.params.summaryId);
    const { cash_sales_value, new_credit_sales_value, other_payment_sales_value } = req.body;

    if (isNaN(summaryId)) {
        return res.status(400).json({ error: 'Invalid Summary ID' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE driver_daily_summaries
             SET total_cash_sales_value = $1,
                 total_new_credit_sales_value = $2,
                 total_other_payment_sales_value = $3,
                 reconciliation_status = 'Reconciled',
                 updated_at = CURRENT_TIMESTAMP
             WHERE summary_id = $4`,
            [
                parseFloat(cash_sales_value),
                parseFloat(new_credit_sales_value),
                parseFloat(other_payment_sales_value),
                summaryId
            ]
        );
        await client.query('COMMIT');
        res.status(200).json({ message: 'Summary reconciled successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

// === DRIVER SALES & SALE ITEMS ===
exports.createDriverSale = async (req, res, next) => {
    const { driver_daily_summary_id, customer_id, payment_type, notes, items } = req.body;
    const area_manager_logged_by_id = req.user.id;

    if (!driver_daily_summary_id || !customer_id || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Invalid request data.' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        const saleResult = await client.query(
            `INSERT INTO driver_sales (driver_daily_summary_id, customer_id, payment_type, notes, area_manager_logged_by_id, total_sale_amount)
             VALUES ($1, $2, $3, $4, $5, 0) RETURNING sale_id`,
            [driver_daily_summary_id, customer_id, payment_type || 'Cash', notes || null, area_manager_logged_by_id]
        );
        const sale_id = saleResult.rows[0].sale_id;
        let sale_total_amount = 0;

        for (const item of items) {
            await client.query(
                `INSERT INTO driver_sale_items (driver_sale_id, product_id, quantity_sold, unit_price, transaction_type)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    sale_id,
                    item.product_id,
                    item.quantity_sold,
                    item.unit_price,
                    item.transaction_type || 'Sale'
                ]
            );
            if (item.transaction_type === 'Sale') {
                sale_total_amount += item.quantity_sold * item.unit_price;
            }
        }

        await client.query('UPDATE driver_sales SET total_sale_amount = $1 WHERE sale_id = $2', [sale_total_amount, sale_id]);
        await updateDriverDailySummaryTotals(client, driver_daily_summary_id);
        await client.query('COMMIT');
        res.status(201).json({ sale_id, total_sale_amount: sale_total_amount });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

exports.getDriverSales = async (req, res, next) => {
    const { summary_id } = req.query;

    if (!summary_id) {
        return res.status(400).json({ error: 'summary_id is required' });
    }

    try {
        const sql = `
            SELECT ds.*, c.customer_name
            FROM driver_sales ds
            JOIN customers c ON ds.customer_id = c.customer_id
            WHERE ds.driver_daily_summary_id = $1
            ORDER BY ds.sale_id`;
        const result = await query(sql, [summary_id]);
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

exports.updateDriverSale = async (req, res, next) => {
    const saleId = parseInt(req.params.saleId);
    const { payment_type, notes } = req.body;

    if (isNaN(saleId)) {
        return res.status(400).json({ error: 'Invalid sale ID' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

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
            values.push(saleId);
            await client.query(
                `UPDATE driver_sales SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE sale_id = $${paramIndex}`,
                values
            );
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

exports.deleteDriverSale = async (req, res, next) => {
    const saleId = parseInt(req.params.saleId);

    if (isNaN(saleId)) {
        return res.status(400).json({ error: 'Invalid sale ID' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query('SELECT driver_daily_summary_id FROM driver_sales WHERE sale_id = $1 FOR UPDATE', [saleId]);
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Sale not found.' });
        }
        const driverDailySummaryId = rows[0].driver_daily_summary_id;

        await client.query('DELETE FROM driver_sale_items WHERE driver_sale_id = $1', [saleId]);
        const deleteSaleResult = await client.query('DELETE FROM driver_sales WHERE sale_id = $1', [saleId]);

        if (deleteSaleResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Sale not found during delete operation.' });
        }

        await updateDriverDailySummaryTotals(client, driverDailySummaryId);
        await client.query('COMMIT');
        res.status(200).json({ message: `Sale ID ${saleId} and its items deleted successfully.` });

    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

// === PRODUCT RETURNS ===
exports.getLossReasons = async (req, res, next) => {
    try {
        const result = await query('SELECT loss_reason_id, reason_description FROM loss_reasons WHERE is_active = TRUE ORDER BY loss_reason_id');
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

exports.createProductReturns = async (req, res, next) => {
    const { driver_id, return_date, items, driver_daily_summary_id } = req.body;
    const area_manager_id = req.user.id;

    console.log(`[SalesOps API] POST /product-returns (batch) - User: ${area_manager_id}, Driver: ${driver_id}`);

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

        await client.query('DELETE FROM product_returns WHERE driver_id = $1 AND return_date = $2', [parseInt(driver_id), return_date]);

        const itemsToLog = items.filter(item => parseFloat(item.quantity_returned) > 0);

        if (itemsToLog.length > 0) {
            const insertPromises = itemsToLog.map(item => {
                const sql = `
                    INSERT INTO product_returns
                    (driver_id, return_date, product_id, quantity_returned, loss_reason_id, custom_reason_for_loss, area_manager_id, notes, driver_daily_summary_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING *;
                `;

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
        res.status(201).json({ message: `Successfully saved ${itemsToLog.length} return entries.` });

    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23503') {
            return next(err);
        }
        next(err);
    } finally {
        client.release();
    }
};

exports.getProductReturns = async (req, res, next) => {
    const { driver_id, date, product_id } = req.query;
    const requesting_user_id = req.user.id;

    console.log(`[SalesOps API] GET /product-returns - User: ${requesting_user_id}, Query: ${JSON.stringify(req.query)}`);

    let sql = `
        SELECT pr.*, d.first_name AS driver_name, p.product_name, lr.reason_description
        FROM product_returns pr
        JOIN drivers d ON pr.driver_id = d.driver_id
        JOIN products p ON pr.product_id = p.product_id
        LEFT JOIN loss_reasons lr ON pr.loss_reason_id = lr.loss_reason_id
    `;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (driver_id) {
        if (!/^\d+$/.test(driver_id)) return res.status(400).json({error: 'Invalid driver_id format.'});
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
        if (!/^\d+$/.test(product_id)) return res.status(400).json({error: 'Invalid product_id format.'});
        conditions.push(`pr.product_id = $${paramIndex++}`);
        values.push(parseInt(product_id));
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY pr.return_date DESC, pr.created_at DESC;';

    try {
        const result = await query(sql, values);
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

// === PACKAGING LOGS & TYPES ===
exports.getPackagingTypes = async (req, res, next) => {
    try {
        const result = await query('SELECT packaging_type_id, type_name, description FROM packaging_types WHERE is_active = TRUE ORDER BY type_name ASC');
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

exports.createPackagingLog = async (req, res, next) => {
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
            if (err.constraint && err.constraint.includes('packaging_type_id')) return next(err);
            return next(err);
        }
        next(err);
    }
};

exports.getPackagingLogs = async (req, res, next) => {
    const { driver_id, date, packaging_type_id } = req.query;
    const requesting_user_id = req.user.id;

    console.log(`[SalesOps API] GET /packaging-logs - User: ${requesting_user_id}, Query: ${JSON.stringify(req.query)}`);

    let sql = `
        SELECT pl.*,\n               d.first_name AS driver_first_name, d.last_name AS driver_last_name,\n               pt.type_name AS packaging_type_name,\n               u_am.username AS area_manager_name
        FROM packaging_logs pl
        JOIN drivers d ON pl.driver_id = d.driver_id
        JOIN packaging_types pt ON pl.packaging_type_id = pt.packaging_type_id
        JOIN users u_am ON pl.area_manager_id = u_am.id
    `;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (driver_id) {
        if (!/^\d+$/.test(driver_id)) return res.status(400).json({error: 'Invalid driver_id format.'});
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
        if (!/^\d+$/.test(packaging_type_id)) return res.status(400).json({error: 'Invalid packaging_type_id format.'});
        conditions.push(`pl.packaging_type_id = $${paramIndex++}`);
        values.push(parseInt(packaging_type_id));
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY pl.log_date DESC, pl.created_at DESC;';

    try {
        const result = await query(sql, values);
        const logsWithFullName = result.rows.map(log => ({
            ...log,
            driver_name: `${log.driver_first_name} ${log.driver_last_name || ''}`.trim()
        }));
        res.json(logsWithFullName);
    } catch (err) {
        next(err);
    }
};

module.exports.updateDriverDailySummaryTotals = updateDriverDailySummaryTotals;

