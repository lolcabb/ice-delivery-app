// 📁 File: routes/orders.js (Backend ETag Support for /today)
const express = require('express');
const router = express.Router();
const db = require('../db/database'); // Assuming db setup is correct
const crypto = require('crypto'); // --- ETag: Required for hashing ---

// --- POST / (Create Order) ---
// (Keep existing POST route as is)
router.post('/', (req, res) => {
  console.log("Received POST /api/orders request");
  const { customerName, address, phone, driverName, status, issuer, orderItems, paymentType } = req.body;
  if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) { return res.status(400).json({ message: 'No order items provided' }); }
  const createdAt = new Date().toISOString();
  const statusUpdatedAt = createdAt;
  const orderStmt = db.prepare(`INSERT INTO orders (customerName, address, phone, driverName, status, issuer, createdAt, statusUpdatedAt, paymentType) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const itemStmt = db.prepare(`INSERT INTO order_items (orderId, productType, quantity, pricePerUnit, totalAmount) VALUES (?, ?, ?, ?, ?)`);
  let orderId;
  try {
    const insertTx = db.transaction(() => {
      const orderResult = orderStmt.run( customerName || '', address || '', phone || '', driverName || '', status || 'Created', issuer || '', createdAt, statusUpdatedAt, paymentType !== undefined ? paymentType : null );
      orderId = orderResult.lastInsertRowid;
      if (!orderId) throw new Error("Failed to get lastInsertRowid for order.");
      for (const item of orderItems) {
        const quantity = parseFloat(item.quantity); const pricePerUnit = parseFloat(item.pricePerUnit);
        if (isNaN(quantity) || isNaN(pricePerUnit) || quantity <= 0 || pricePerUnit < 0) { console.warn(`Skipping invalid item for order ${orderId}:`, item); continue; }
        const totalAmount = quantity * pricePerUnit;
        itemStmt.run( orderId, item.productType || 'N/A', quantity, pricePerUnit, totalAmount );
      }
    });
    insertTx();
    if (orderId) {
      const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (createdOrder) {
        const createdItems = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(orderId);
        createdOrder.items = createdItems || [];
        res.status(201).json(createdOrder);
      } else { res.status(500).json({ message: 'Order created but failed to retrieve details' }); }
    } else { throw new Error('Order ID not obtained after transaction.'); }
  } catch (err) { console.error("Error during order creation:", err); res.status(500).json({ message: 'Failed to create order on the server' }); }
});


// --- GET / (All Orders - with date/driver filter) ---
// (Keep existing GET / route as is)
router.get('/', (req, res) => {
    console.log("Received GET /api/orders request with query:", req.query);
    const { date, driverName } = req.query;
    let baseQuery = 'SELECT * FROM orders'; const params = []; const conditions = [];
    if (driverName) { conditions.push('driverName = ?'); params.push(driverName); }
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) { conditions.push("date(createdAt) = date(?)"); params.push(date); }
    else if (date) { console.warn(`Invalid date format received: ${date}. Ignoring date filter.`); }
    if (conditions.length > 0) { baseQuery += ' WHERE ' + conditions.join(' AND '); }
    baseQuery += ' ORDER BY createdAt DESC';
    try {
        console.log("Executing query:", baseQuery, params);
        const orders = db.prepare(baseQuery).all(...params);
        console.log(`Fetched ${orders.length} order headers matching criteria.`);
        const itemStmt = db.prepare('SELECT * FROM order_items WHERE orderId = ?');
        const resultsWithItems = orders.map(order => ({ ...order, items: itemStmt.all(order.id) || [] }));
        console.log("Sending successful response for GET /api/orders");
        res.json(resultsWithItems);
    } catch (err) { console.error("Error fetching orders:", err); res.status(500).json({ message: 'Failed to fetch orders' }); }
});


// --- GET /today ---
// *** MODIFIED TO SUPPORT ETAG CACHING ***
router.get('/today', (req, res) => {
  console.log("Received GET /api/orders/today request");
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startISOString = startOfDay.toISOString();

  try {
    // Fetch data (same query as before)
    const orders = db.prepare('SELECT * FROM orders WHERE datetime(createdAt) >= datetime(?) ORDER BY createdAt DESC').all(startISOString);
    const itemStmt = db.prepare('SELECT * FROM order_items WHERE orderId = ?');
    const ordersWithItems = orders.map(order => ({ ...order, items: itemStmt.all(order.id) || [] }));

    // --- ETag Logic ---
    // 1. Generate ETag for the current data
    //    (Simple approach: hash the JSON string representation)
    const dataString = JSON.stringify(ordersWithItems);
    const currentEtag = crypto.createHash('md5').update(dataString).digest('hex');
    const quotedEtag = `"${currentEtag}"`; // ETags should be quoted

    // 2. Check If-None-Match request header
    const incomingEtag = req.headers['if-none-match'];

    // 3. Compare ETags
    if (incomingEtag && incomingEtag === quotedEtag) {
      // 4. Client has fresh data, send 304 Not Modified
      console.log(`ETag match (${quotedEtag}). Sending 304 Not Modified.`);
      return res.status(304).end(); // Use return to stop execution
    }

    // 5. No match or no If-None-Match header: Send 200 OK with data and ETag header
    console.log(`ETag mismatch or no If-None-Match. Sending 200 OK with ETag: ${quotedEtag}`);
    res.setHeader('ETag', quotedEtag); // Set the ETag header
    res.json(Array.isArray(ordersWithItems) ? ordersWithItems : []);
    // --- End ETag Logic ---

  } catch (err) {
    console.error("Error fetching today's orders:", err);
    res.status(500).json({ error: 'Failed to fetch today\'s orders' });
  }
});
// --- END MODIFICATION ---


// --- GET /:id (Single Order) ---
// (Keep existing GET /:id route as is)
router.get('/:id', (req, res) => {
    console.log(`Received GET /api/orders/${req.params.id} request`);
    const { id } = req.params;
    if (!/^\d+$/.test(id)) { return res.status(400).json({ message: 'Invalid order ID format' }); }
    try {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (!order) { return res.status(404).json({ message: 'Order not found' }); }
        const items = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(order.id);
        order.items = items || [];
        res.json(order);
    } catch (err) { console.error(`Error fetching order ${id}:`, err); res.status(500).json({ message: 'Failed to fetch order details' }); }
});


// --- PUT /:id (Update Order - Flexible) ---
// (Keep existing PUT /:id route as is - already handles partial updates including paymentType: null)
router.put('/:id', (req, res) => {
    const orderId = req.params.id;
    console.log(`Received PUT /api/orders/${orderId} request with body:`, req.body);
    const { customerName, status, driverName, paymentType, orderItems } = req.body;
    if (!/^\d+$/.test(orderId)) { return res.status(400).json({ message: 'Invalid order ID format' }); }
    if (orderItems !== undefined && !Array.isArray(orderItems)) { console.log("Validation failed: orderItems provided but is not an array."); return res.status(400).json({ message: 'If provided, orderItems must be an array' }); }
    const deleteItemsStmt = db.prepare('DELETE FROM order_items WHERE orderId = ?');
    const insertItemStmt = db.prepare(`INSERT INTO order_items (orderId, productType, quantity, pricePerUnit, totalAmount) VALUES (?, ?, ?, ?, ?)`);
    try {
        console.log(`Starting transaction for updating order ${orderId}`);
        const updateTx = db.transaction(() => {
            const currentOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
            if (!currentOrder) { throw new Error('Order not found'); }
            const orderUpdates = []; const orderParams = [];
            if (customerName !== undefined) { orderUpdates.push('customerName = ?'); orderParams.push(customerName); }
            if (driverName !== undefined) { orderUpdates.push('driverName = ?'); orderParams.push(driverName); }
            if (paymentType !== undefined) { const allowedTypes = ['Cash', 'Debit', 'Credit', null]; if (allowedTypes.includes(paymentType)) { orderUpdates.push('paymentType = ?'); orderParams.push(paymentType); } else { console.warn(`Invalid paymentType ignored: ${paymentType}`); } }
            if (status !== undefined && status !== currentOrder.status) { orderUpdates.push('status = ?'); orderParams.push(status); orderUpdates.push('statusUpdatedAt = ?'); orderParams.push(new Date().toISOString()); }
            if (orderUpdates.length > 0) { orderParams.push(orderId); const updateOrderSql = `UPDATE orders SET ${orderUpdates.join(', ')} WHERE id = ?`; console.log("Executing order update:", updateOrderSql, orderParams); const updateResult = db.prepare(updateOrderSql).run(...orderParams); console.log(`Order table update result for ${orderId}:`, updateResult); } else { console.log(`No changes detected for main order fields for order ${orderId}.`); }
            if (Array.isArray(orderItems)) { console.log(`Updating items for order ${orderId} as orderItems array was provided.`); const deleteResult = deleteItemsStmt.run(orderId); console.log(`Deleted ${deleteResult.changes} existing items.`); let insertedItemCount = 0; for (const item of orderItems) { const productType = item.productType || 'N/A'; const quantity = parseFloat(item.quantity); const pricePerUnit = parseFloat(item.pricePerUnit); if (isNaN(quantity) || isNaN(pricePerUnit) || quantity <= 0 || pricePerUnit < 0) { console.warn(`Skipping invalid item data during update:`, item); continue; } const totalAmount = quantity * pricePerUnit; insertItemStmt.run(orderId, productType, quantity, pricePerUnit, totalAmount); insertedItemCount++; } console.log(`Inserted ${insertedItemCount} new items.`); } else { console.log(`No 'orderItems' array provided in request body. Skipping item update for order ${orderId}.`); }
        });
        updateTx();
        console.log(`Transaction committed successfully for order ${orderId}`);
        const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
        if (updatedOrder) { const updatedItems = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(orderId); updatedOrder.items = updatedItems || []; res.json({ message: 'Order updated successfully', order: updatedOrder }); }
        else { console.error(`CRITICAL: Failed to fetch order ${orderId} after successful update transaction.`); res.status(500).json({ message: 'Order updated but failed to retrieve final details' }); }
    } catch (err) { console.error(`Error during order update transaction for ${orderId}:`, err); if (err.message === 'Order not found') { res.status(404).json({ message: 'Order not found' }); } else { res.status(500).json({ message: 'Failed to update order on the server' }); } }
});


module.exports = router; // Export the router
