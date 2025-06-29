// routes/orders.js (Refactored for PostgreSQL + Aliases)
// Assumes standard PostgreSQL lowercase column names unless schema uses quoted identifiers.
// Adds SQL aliases to return camelCase keys to the frontend.

const express = require('express');
const router = express.Router();
// Use the PostgreSQL connection pool module
const db = require('../db/postgres');
const crypto = require('crypto'); // Required for ETag generation
const { authMiddleware, requireRole } = require('../middleware/auth'); // <-- Import auth middleware

// Helper function to create SELECT clause with aliases
const getOrderSelectClause = (aliasPrefix = 'o.') => {
    return `
        ${aliasPrefix}id, ${aliasPrefix}customername AS "customerName", ${aliasPrefix}address, ${aliasPrefix}phone,
        ${aliasPrefix}drivername AS "driverName", ${aliasPrefix}status, ${aliasPrefix}issuer,
        ${aliasPrefix}createdat AS "createdAt", ${aliasPrefix}statusupdatedat AS "statusUpdatedAt",
        ${aliasPrefix}paymenttype AS "paymentType"
    `; // Alias added
};

const getItemSelectClause = (aliasPrefix = 'oi.') => {
    return `
        ${aliasPrefix}id, ${aliasPrefix}orderid AS "orderId", ${aliasPrefix}producttype AS "productType",
        ${aliasPrefix}quantity, ${aliasPrefix}priceperunit AS "pricePerUnit",
        ${aliasPrefix}totalamount AS "totalAmount"
    `; // Alias added
};


// --- POST / (Create Order) ---
router.post('/', authMiddleware, async (req, res) => { // Use async handler
    console.log("Received POST /api/orders request");
    const { customerName, address, phone, driverName, status, issuer, orderItems, paymentType } = req.body;

    // Input validation... (keep existing validation)
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) { return res.status(400).json({ message: 'No order items provided' }); }
    if (!issuer || typeof issuer !== 'string' || issuer.trim() === '') { return res.status(400).json({ message: 'Issuer name is required' }); }

    const client = await db.getClient();
    console.log("DB client acquired for transaction.");

    try {
        await client.query('BEGIN');
        console.log("Transaction BEGIN");

        const createdAt = new Date();
        const statusUpdatedAt = createdAt;

        // Use lowercase column names for INSERT
        const orderQuery = `
      INSERT INTO orders (customername, address, phone, drivername, status, issuer, createdat, statusupdatedat, paymenttype)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`;
        const orderValues = [ customerName || null, address || null, phone || null, driverName || null, status || 'Created', issuer.trim(), createdAt, statusUpdatedAt, paymentType !== undefined ? paymentType : null ];
        const orderResult = await client.query(orderQuery, orderValues);
        const orderId = orderResult.rows[0]?.id;
        if (!orderId) { throw new Error("Failed to get ID for inserted order."); }
        console.log(`Inserted order with ID: ${orderId}`);

        // Use lowercase column names for INSERT
        const itemQuery = `
      INSERT INTO order_items (orderid, producttype, quantity, priceperunit, totalamount)
      VALUES ($1, $2, $3, $4, $5)`;
        const itemInsertPromises = [];
        let validItemsCount = 0;
        for (const item of orderItems) { // Validation... (keep existing validation)
            const quantity = parseFloat(item.quantity); const pricePerUnit = parseFloat(item.pricePerUnit);
            if (isNaN(quantity) || isNaN(pricePerUnit) || quantity <= 0 || pricePerUnit < 0 || !item.productType) { console.warn(`Skipping invalid item for order ${orderId}:`, item); continue; }
            validItemsCount++; const totalAmount = quantity * pricePerUnit;
            const itemValues = [ orderId, item.productType, quantity, pricePerUnit, totalAmount ];
            itemInsertPromises.push(client.query(itemQuery, itemValues));
        }
        if (validItemsCount === 0) { throw new Error("No valid order items to insert."); }
        await Promise.all(itemInsertPromises);
        console.log(`Inserted ${itemInsertPromises.length} valid items for order ${orderId}`);

        await client.query('COMMIT');
        console.log("Transaction COMMIT");

        // Fetch the created order with items to return it, using aliases
        const createdOrderQuery = `SELECT ${getOrderSelectClause()} FROM orders o WHERE o.id = $1`; // Use helper for aliases
        const createdOrderResult = await client.query(createdOrderQuery, [orderId]);
        const createdOrder = createdOrderResult.rows[0];

        if (createdOrder) {
            const createdItemsQuery = `SELECT ${getItemSelectClause()} FROM order_items oi WHERE oi.orderid = $1`; // Use helper for aliases
            const createdItemsResult = await client.query(createdItemsQuery, [orderId]);
            // Result rows will have camelCase keys, assign directly
            createdOrder.items = createdItemsResult.rows || [];
            res.status(201).json(createdOrder); // Send camelCase data
        } else { res.status(500).json({ message: 'Order created but failed to retrieve details immediately after.' }); }

    } catch (err) { // Error handling... (keep existing handling)
        console.error("Error during order creation transaction:", err);
        try { await client.query('ROLLBACK'); console.log("Transaction ROLLBACK due to error:", err.message); }
        catch (rollbackErr) { console.error('Fatal: Failed to rollback transaction:', rollbackErr); }
        if (err.message === "No valid order items to insert.") { res.status(400).json({ message: err.message }); }
        else { res.status(500).json({ message: 'Failed to create order on the server.' }); }
    } finally { client.release(); console.log("DB client released."); }
});


// --- GET / (All Orders - with date/driver filter) --- CORRECTIONS APPLIED ---
router.get('/', authMiddleware, async (req, res) => {
    console.log("Received GET /api/orders request with query:", req.query);
    const { date, driverName } = req.query;
    const TARGET_TIMEZONE = 'Asia/Bangkok'; // Define target timezone

    // Use helper for SELECT clause with aliases
    let baseQuery = `SELECT ${getOrderSelectClause()} FROM orders o`;
    const params = []; // Use this array for parameters
    const conditions = [];
    let paramIndex = 1; // Start parameter index at $1

    // Add driver name condition if present
    if (driverName) {
        conditions.push(`o.drivername = $${paramIndex++}`); // Use lowercase column name
        params.push(driverName);
    }

    // --- CORRECTED DATE HANDLING ---
    // Add date boundary conditions if date is present and valid
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        // Add condition for start of day (inclusive)
        conditions.push(`o.createdat >= (($${paramIndex})::date)::timestamp AT TIME ZONE $${paramIndex + 1}`);
        // Add condition for end of day (exclusive)
        conditions.push(`o.createdat < (($${paramIndex}::date + INTERVAL '1 day')::timestamp AT TIME ZONE $${paramIndex + 1})`);

        // Add the parameters IN ORDER: date first ($${paramIndex}), then timezone ($${paramIndex + 1})
        params.push(date);
        params.push(TARGET_TIMEZONE);
        paramIndex += 2; // Increment index by 2 for the two parameters added

    } else if (date) {
        // Log if date format is invalid but ignore the filter
        console.warn(`Invalid date format received: ${date}. Ignoring date filter.`);
    }
    // --- END OF CORRECTED DATE HANDLING ---

    // Append WHERE clause if any conditions exist
    if (conditions.length > 0) {
        baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    // Add ORDER BY clause (using lowercase column name)
    baseQuery += ' ORDER BY o.createdat DESC';

    try {
        console.log("Executing query:", baseQuery.trim().replace(/\s+/g, ' '), params); // Log query and params
        const ordersResult = await db.query(baseQuery, params); // Execute with correct params
        const orders = ordersResult.rows; // Orders will have camelCase keys due to aliases
        console.log(`Fetched ${orders.length} order headers matching criteria.`);

        // Fetch items efficiently (logic remains the same)
        let resultsWithItems = [];
        if (orders.length > 0) {
            const orderIds = orders.map(o => o.id);
            const allItemsQuery = `SELECT ${getItemSelectClause()} FROM order_items oi WHERE oi.orderid = ANY($1::bigint[])`; // Use helper
            const allItemsResult = await db.query(allItemsQuery, [orderIds]);
            const itemsByOrderId = allItemsResult.rows.reduce((acc, item) => {
                 (acc[item.orderId] = acc[item.orderId] || []).push(item); // Group by camelCase orderId
                 return acc;
            }, {});
             resultsWithItems = orders.map(order => ({
                 ...order,
                 items: itemsByOrderId[order.id] || [] // Map using camelCase order.id
             }));
        }

        console.log("Sending successful response for GET /api/orders");
        res.json(resultsWithItems); // Send camelCase data

    } catch (err) {
        console.error("Error fetching orders:", err);
        if (err.code) {
            console.error(`PostgreSQL Error Code: ${err.code}`);
        }
        res.status(500).json({ message: 'Failed to fetch orders' });
    }
});


/**
 * Fetches orders created "today" based on a specific timezone.
 * Implements ETag caching to reduce load and bandwidth.
 *
 * Route: GET /api/orders/today
 * Timezone: Asia/Bangkok (hardcoded)
 * Dependencies:
 * - `db`: node-postgres client instance (e.g., Pool)
 * - `getOrderSelectClause`: Helper function returning SQL select fragment for orders.
 * - `getItemSelectClause`: Helper function returning SQL select fragment for items.
 * - `crypto`: Node.js crypto module for ETag generation.
 */
router.get('/today', authMiddleware, async (req, res) => {
    console.log("Received GET /api/orders/today request");
    const targetTimezone = 'Asia/Bangkok'; // Define the target timezone for "today"

    try {
        // --- Step 1: Fetch Orders Created Today (in Target Timezone) ---

        // This query calculates the TIMESTAMPTZ boundaries for "today" in the target timezone
        // and selects orders whose `createdat` falls within those boundaries.
        const ordersQuery = `
            -- Calculate the start and end timestamps for "today" in the target timezone
            WITH today_local AS (
                -- 1. Get midnight in the target timezone as a local timestamp (TIMESTAMP WITHOUT TIME ZONE)
                SELECT DATE_TRUNC('day', NOW() AT TIME ZONE $1) AS midnight_local
            ),
            today_boundaries AS (
                -- 2. Convert the local midnight boundaries back to TIMESTAMPTZ (UTC equivalent)
                SELECT
                    (tl.midnight_local AT TIME ZONE $1) AS start_of_today,
                    ((tl.midnight_local + INTERVAL '1 day') AT TIME ZONE $1) AS start_of_tomorrow
                FROM today_local tl
            )
            -- Select orders created within the calculated boundaries
            SELECT ${getOrderSelectClause()}
            FROM orders o
            CROSS JOIN today_boundaries tb -- Make boundaries available for filtering
            WHERE
                o.createdat >= tb.start_of_today
            AND
                o.createdat < tb.start_of_tomorrow
            ORDER BY o.createdat DESC;
        `;

        console.log('DEBUG: Executing ordersQuery:', ordersQuery);

        const ordersResult = await db.query(ordersQuery, [targetTimezone]);
        const orders = ordersResult.rows; // Assuming helpers provide camelCase aliases

        console.log(`/today raw orders from DB length: ${orders.length}`);
        // --- Step 2: Fetch Associated Items (if any orders were found) ---

        let ordersWithItems = [];
        if (orders.length > 0) {
            const orderIds = orders.map(o => o.id); // Extract order IDs

            const itemsQuery = `
                SELECT ${getItemSelectClause('')}
                FROM order_items oi
                WHERE oi.orderid = ANY($1::bigint[]); -- Efficiently fetch items for multiple orders
             `;
            const itemsResult = await db.query(itemsQuery, [orderIds]);
            const allItems = itemsResult.rows; // Assuming helpers provide camelCase aliases

            // Group items by orderId for efficient lookup O(N)
            const itemsByOrderId = allItems.reduce((acc, item) => {
                const id = item.orderId; // Assumes item object has orderId key
                (acc[id] = acc[id] || []).push(item); // Initialize array if needed
                return acc;
            }, {});

            // Combine orders with their items using map O(M)
            ordersWithItems = orders.map(order => ({
                ...order,
                items: itemsByOrderId[order.id] || [], // Assign items, default to empty array if none found
            }));
        }
        // If orders.length === 0, ordersWithItems remains []
        console.log(`/today final ordersWithItems length: ${ordersWithItems.length}`);
        // --- Step 3: ETag Cache Handling ---

        const dataString = JSON.stringify(ordersWithItems);
        // Use a fast hash like MD5 for ETags (collision resistance isn't the primary goal here)
        const currentEtag = crypto.createHash('md5').update(dataString).digest('hex');
        const quotedEtag = `"${currentEtag}"`; // ETags should be quoted

        const incomingEtag = req.headers['if-none-match']; // Check client's cache

        // If client's ETag matches the current data ETag, send 304 Not Modified
        if (incomingEtag && incomingEtag === quotedEtag) {
            console.log(`ETag match for /today. Sending 304.`);
            return res.status(304).end(); // Use return to stop execution
        }

        // --- Step 4: Send Response with New ETag ---

        console.log(`Sending 200 OK for /today with ETag: ${quotedEtag}`);
        res.setHeader('ETag', quotedEtag); // Set the ETag for the client to cache
        res.json(ordersWithItems); // Send the data

    } catch (err) {
        // --- Error Handling ---
        console.error("Error fetching today's orders:", err); // Log the full error server-side

        // Log specific PostgreSQL error code if available for easier debugging
        if (err.code) {
            console.error(`PostgreSQL Error Code: ${err.code}`);
        }

        // Send a generic error response to the client
        res.status(500).json({ error: "Failed to fetch today's orders. Please try again later." });
    }
});


// --- GET /:id (Single Order) ---
router.get('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    console.log(`Received GET /api/orders/${id} request`);
    if (!/^\d+$/.test(id)) { return res.status(400).json({ message: 'Invalid order ID format. Must be an integer.' }); }
    const orderId = parseInt(id, 10);

    try {
        // Use helper for order aliases
        const orderQuery = `SELECT ${getOrderSelectClause()} FROM orders o WHERE o.id = $1`;
        const orderResult = await db.query(orderQuery, [orderId]);
        const order = orderResult.rows[0]; // Will have camelCase keys

        if (!order) { return res.status(404).json({ message: 'Order not found' }); }

        // Use helper for item aliases
        const itemsQuery = `SELECT ${getItemSelectClause()} FROM order_items oi WHERE oi.orderid = $1`;
        const itemsResult = await db.query(itemsQuery, [orderId]);
        order.items = itemsResult.rows || []; // Items will have camelCase keys

        res.json(order); // Send camelCase data
    } catch (err) { console.error(`Error fetching order ${id}:`, err); res.status(500).json({ message: 'Failed to fetch order details' }); }
});


// --- PUT /:id (Update Order - Flexible) ---
router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    console.log(`Received PUT /api/orders/${id} request with body:`, req.body);
    if (!/^\d+$/.test(id)) { return res.status(400).json({ message: 'Invalid order ID format. Must be an integer.' }); }
    const orderId = parseInt(id, 10);
    const { customerName, status, driverName, paymentType, orderItems } = req.body;
    if (orderItems !== undefined && !Array.isArray(orderItems)) { return res.status(400).json({ message: 'If provided, orderItems must be an array' }); }

    const client = await db.getClient();
    console.log(`DB client acquired for updating order ${orderId}`);

    try {
        await client.query('BEGIN');
        console.log(`Transaction BEGIN for updating order ${orderId}`);

        // Check if order exists (select lowercase status)
        const checkOrderResult = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
        if (checkOrderResult.rows.length === 0) { throw new Error('Order not found'); }
        const currentStatus = checkOrderResult.rows[0].status;

        // Update main order fields (use lowercase column names in SET clause)
        const orderUpdates = []; const orderParams = []; let paramIndex = 1;
        if (customerName !== undefined) { orderUpdates.push(`customername = $${paramIndex++}`); orderParams.push(customerName); }
        if (driverName !== undefined) { orderUpdates.push(`drivername = $${paramIndex++}`); orderParams.push(driverName); }
        if (paymentType !== undefined) { const allowedTypes = ['Cash', 'Debit', 'Credit', null]; if (allowedTypes.includes(paymentType)) { orderUpdates.push(`paymenttype = $${paramIndex++}`); orderParams.push(paymentType); } else { console.warn(`Invalid paymentType ignored: ${paymentType}`); } }
        if (status !== undefined && status !== currentStatus) { orderUpdates.push(`status = $${paramIndex++}`); orderParams.push(status); orderUpdates.push(`statusupdatedat = $${paramIndex++}`); orderParams.push(new Date()); }

        if (orderUpdates.length > 0) { orderParams.push(orderId); const updateOrderSql = `UPDATE orders SET ${orderUpdates.join(', ')} WHERE id = $${paramIndex}`; console.log("Executing order update:", updateOrderSql, orderParams); const updateResult = await client.query(updateOrderSql, orderParams); console.log(`Order table update result for ${orderId}: ${updateResult.rowCount} row(s) affected.`); }
        else { console.log(`No changes detected for main order fields for order ${orderId}.`); }

        // Update order items (if provided) - use lowercase column names for insert/delete
        if (Array.isArray(orderItems)) {
            console.log(`Updating items for order ${orderId} as orderItems array was provided.`);
            const deleteItemsSql = 'DELETE FROM order_items WHERE orderid = $1'; // lowercase
            const deleteResult = await client.query(deleteItemsSql, [orderId]);
            console.log(`Deleted ${deleteResult.rowCount} existing items.`);

            const insertItemSql = `INSERT INTO order_items (orderid, producttype, quantity, priceperunit, totalamount) VALUES ($1, $2, $3, $4, $5)`; // lowercase
            let insertedItemCount = 0; const itemInsertPromises = [];
            for (const item of orderItems) { // Validation... (keep existing validation)
                 const quantity = parseFloat(item.quantity); const pricePerUnit = parseFloat(item.pricePerUnit);
                 if (isNaN(quantity) || isNaN(pricePerUnit) || quantity <= 0 || pricePerUnit < 0 || !item.productType || item.productType === 'N/A') { console.warn(`Skipping invalid item data during update:`, item); continue; }
                 insertedItemCount++; const totalAmount = quantity * pricePerUnit;
                 const itemValues = [orderId, item.productType, quantity, pricePerUnit, totalAmount];
                 itemInsertPromises.push(client.query(insertItemSql, itemValues));
            }
            await Promise.all(itemInsertPromises);
            console.log(`Inserted ${insertedItemCount} new items.`);
        } else { console.log(`No 'orderItems' array provided in request body. Skipping item update for order ${orderId}.`); }

        await client.query('COMMIT');
        console.log(`Transaction committed successfully for order ${orderId}`);

        // Fetch and return the updated order using aliases
        const updatedOrderQuery = `SELECT ${getOrderSelectClause()} FROM orders o WHERE o.id = $1`; // Use helper
        const updatedOrderResult = await client.query(updatedOrderQuery, [orderId]);
        const updatedOrder = updatedOrderResult.rows[0]; // Will have camelCase keys

        if (updatedOrder) {
            const updatedItemsQuery = `SELECT ${getItemSelectClause()} FROM order_items oi WHERE oi.orderid = $1`; // Use helper
            const updatedItemsResult = await client.query(updatedItemsQuery, [orderId]);
            updatedOrder.items = updatedItemsResult.rows || []; // Items will have camelCase keys
            res.json({ message: 'Order updated successfully', order: updatedOrder }); // Send camelCase data
        } else { console.error(`CRITICAL: Failed to fetch order ${orderId} after successful update transaction.`); res.status(500).json({ message: 'Order updated but failed to retrieve final details' }); }

    } catch (err) { // Error handling... (keep existing handling)
        console.error(`Error during order update transaction for ${orderId}:`, err);
        try { await client.query('ROLLBACK'); console.log("Transaction ROLLBACK due to error:", err.message); }
        catch (rollbackErr) { console.error('Fatal: Failed to rollback transaction:', rollbackErr); }
        if (err.message === 'Order not found') { res.status(404).json({ message: 'Order not found' }); }
        else { res.status(500).json({ message: 'Failed to update order on the server.' }); }
    } finally { client.release(); console.log(`DB client released for order update ${orderId}`); }
});

// --- DELETE Order ---
// (No SELECT statement here, so no aliases needed for delete logic)
router.delete('/:id', authMiddleware, requireRole(['admin', 'manager']), async (req, res) => { // Use async handler
    const orderIdStr = req.params.id;
    console.log(`Received DELETE /api/orders/${orderIdStr}`);

    if (!/^\d+$/.test(orderIdStr)) {
        return res.status(400).json({ message: 'Invalid order ID format' });
    }
    const orderId = parseInt(orderIdStr, 10);

    const client = await db.getClient(); // Get client for transaction
    console.log(`DB client acquired for deleting order ${orderId}`);

    try {
        await client.query('BEGIN'); // Start transaction
        console.log(`Transaction BEGIN for deleting order ${orderId}`);

        // Delete items first (use lowercase orderid column name)
        const deleteItemsResult = await client.query('DELETE FROM order_items WHERE orderid = $1', [orderId]);
        console.log(`Deleted ${deleteItemsResult.rowCount} items for order ${orderId}`);

        // Delete the order itself
        const deleteOrderResult = await client.query('DELETE FROM orders WHERE id = $1', [orderId]);
        console.log(`Delete order result for ${orderId}: ${deleteOrderResult.rowCount} row(s) affected.`);

        // Check if the order was actually found and deleted
        if (deleteOrderResult.rowCount === 0) {
            throw new Error('Order not found'); // This will trigger rollback
        }

        await client.query('COMMIT'); // Commit transaction
        console.log(`Transaction COMMIT for deleting order ${orderId}`);
        return res.status(200).json({ message: 'Order deleted successfully' });

    } catch (err) {
        console.error(`Error deleting order ${orderId}:`, err);
        try {
            await client.query('ROLLBACK'); // Rollback on error
            console.log("Transaction ROLLBACK due to error:", err.message);
        } catch (rollbackErr) {
            console.error('Failed to rollback transaction:', rollbackErr);
        }
        if (err.message === 'Order not found') {
            return res.status(404).json({ message: 'Order not found' });
        }
        return res.status(500).json({ message: 'Failed to delete order on the server' });
    } finally {
        client.release(); // Release client back to pool
        console.log(`DB client released for deleting order ${orderId}`);
    }
});

module.exports = router; // Export the router
