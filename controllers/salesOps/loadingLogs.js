const { query, getClient, pool } = require('../../db/postgres');
const { v4: uuidv4, validate: uuidValidate } = require('uuid');

// Helper for uuid validation if uuid library lacks validate
const uuidValidateRegex = (uuid) => {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

// === LOADING LOGS ===
exports.createLoadingLogs = async (req, res, next) => {
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

        const driverCheckResult = await client.query('SELECT driver_id FROM drivers WHERE driver_id = $1', [parseInt(driver_id)]);
        if (driverCheckResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Operation failed: The provided Driver ID (${driver_id}) does not exist in the database.` });
        }

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
        console.log(`[SalesOps API] Transaction COMMIT. Batch ${batchUUID} created with ${createdItems.length} logs.`);

        res.status(201).json({
            success: true,
            batch_uuid: batchUUID,
            ...commonData,
            items: createdItems,
            items_count: createdItems.length,
            driver_name: driverNameResult?.rows[0] ? `${driverNameResult.rows[0].first_name} ${driverNameResult.rows[0].last_name || ''}`.trim() : null,
            route_name: routeNameResult?.rows[0]?.route_name || null,
            area_manager_name: areaManagerNameResult?.rows[0]?.username || null
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[SalesOps API] Transaction ROLLBACK for batch loading log. Error: ${err.message}`);
        next(err);
    } finally {
        client.release();
    }
};

exports.getLoadingLogs = async (req, res, next) => {
    const { driver_id, route_id, load_type, batch_uuid, date } = req.query;
    const requesting_user_id = req.user.id;

    console.log(`[SalesOps API] GET /loading-logs - User: ${requesting_user_id}, Query: ${JSON.stringify(req.query)}`);

    let sql = `
        SELECT ll.*, d.first_name AS driver_name, r.route_name, u.username AS area_manager_name
        FROM loading_logs ll
        LEFT JOIN drivers d ON ll.driver_id = d.driver_id
        LEFT JOIN delivery_routes r ON ll.route_id = r.route_id
        LEFT JOIN users u ON ll.area_manager_id = u.id
    `;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (driver_id) {
        conditions.push(`ll.driver_id = $${paramIndex++}`);
        values.push(parseInt(driver_id));
    }
    if (route_id) {
        conditions.push(`ll.route_id = $${paramIndex++}`);
        values.push(parseInt(route_id));
    }
    if (load_type) {
        conditions.push(`ll.load_type = $${paramIndex++}`);
        values.push(load_type);
    }
    if (batch_uuid) {
        conditions.push(`ll.load_batch_uuid = $${paramIndex++}`);
        values.push(batch_uuid);
    }
    if (date) {
        conditions.push(`DATE(ll.load_timestamp AT TIME ZONE 'Asia/Bangkok') = $${paramIndex++}`);
        values.push(date);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY ll.load_timestamp DESC, ll.load_batch_uuid DESC, ll.loading_log_id ASC;';

    try {
        const result = await query(sql, values);
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

exports.updateLoadingLogBatch = async (req, res, next) => {
    const { batchUUID } = req.params;
    const { driver_id, route_id, load_type, load_timestamp, notes, items } = req.body;
    const area_manager_id = req.user.id;

    const isValidUUID = typeof uuidValidate === 'function' ? uuidValidate(batchUUID) : uuidValidateRegex(batchUUID);
    if (!isValidUUID) {
        return res.status(400).json({ error: 'Invalid batch UUID format.' });
    }

    const finalLoadTimestamp = load_timestamp ? new Date(load_timestamp) : new Date();
    if (isNaN(finalLoadTimestamp.getTime())) {
        return res.status(400).json({ error: 'Invalid load_timestamp format.' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        if (driver_id) {
            const driverCheck = await client.query('SELECT driver_id FROM drivers WHERE driver_id = $1', [parseInt(driver_id)]);
            if (driverCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Driver with ID ${driver_id} not found.` });
            }
        }

        if (route_id) {
            const routeCheck = await client.query('SELECT route_id FROM delivery_routes WHERE route_id = $1', [parseInt(route_id)]);
            if (routeCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Route with ID ${route_id} not found.` });
            }
        }

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

        const deleteResult = await client.query(
            'DELETE FROM loading_logs WHERE load_batch_uuid = $1 RETURNING loading_log_id',
            [batchUUID]
        );

        console.log(`[SalesOps API] Deleted ${deleteResult.rowCount} existing logs for batch ${batchUUID}`);

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

        next(err);
    } finally {
        client.release();
    }
};

