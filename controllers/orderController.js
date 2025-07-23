const db = require('../db/postgres');
const crypto = require('crypto');

const getOrderSelectClause = (aliasPrefix = 'o.') => {
    return `
        ${aliasPrefix}id, ${aliasPrefix}customername AS "customerName", ${aliasPrefix}address, ${aliasPrefix}phone,
        ${aliasPrefix}drivername AS "driverName", ${aliasPrefix}status, ${aliasPrefix}issuer,
        ${aliasPrefix}createdat AS "createdAt", ${aliasPrefix}statusupdatedat AS "statusUpdatedAt",
        ${aliasPrefix}paymenttype AS "paymentType"
    `;
};

const getItemSelectClause = (aliasPrefix = 'oi.') => {
    return `
        ${aliasPrefix}id, ${aliasPrefix}orderid AS "orderId", ${aliasPrefix}producttype AS "productType",
        ${aliasPrefix}quantity, ${aliasPrefix}priceperunit AS "pricePerUnit",
        ${aliasPrefix}totalamount AS "totalAmount"
    `;
};

module.exports = {
    async createOrder(req, res, next) {
        const { customerName, address, phone, driverName, status, issuer, orderItems, paymentType } = req.body;
        if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
            return res.status(400).json({ message: 'No order items provided' });
        }
        if (!issuer || typeof issuer !== 'string' || issuer.trim() === '') {
            return res.status(400).json({ message: 'Issuer name is required' });
        }
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const createdAt = new Date();
            const statusUpdatedAt = createdAt;
            const orderQuery = `
      INSERT INTO orders (customername, address, phone, drivername, status, issuer, createdat, statusupdatedat, paymenttype)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`;
            const orderValues = [ customerName || null, address || null, phone || null, driverName || null, status || 'Created', issuer.trim(), createdAt, statusUpdatedAt, paymentType !== undefined ? paymentType : null ];
            const orderResult = await client.query(orderQuery, orderValues);
            const orderId = orderResult.rows[0]?.id;
            if (!orderId) throw new Error('Failed to get ID for inserted order.');
            const itemQuery = `
      INSERT INTO order_items (orderid, producttype, quantity, priceperunit, totalamount)
      VALUES ($1, $2, $3, $4, $5)`;
            const itemInsertPromises = [];
            let validItemsCount = 0;
            for (const item of orderItems) {
                const quantity = parseFloat(item.quantity);
                const pricePerUnit = parseFloat(item.pricePerUnit);
                if (isNaN(quantity) || isNaN(pricePerUnit) || quantity <= 0 || pricePerUnit < 0 || !item.productType) continue;
                validItemsCount++;
                const totalAmount = quantity * pricePerUnit;
                const itemValues = [ orderId, item.productType, quantity, pricePerUnit, totalAmount ];
                itemInsertPromises.push(client.query(itemQuery, itemValues));
            }
            if (validItemsCount === 0) throw new Error('No valid order items to insert.');
            await Promise.all(itemInsertPromises);
            await client.query('COMMIT');
            const createdOrderQuery = `SELECT ${getOrderSelectClause()} FROM orders o WHERE o.id = $1`;
            const createdOrderResult = await client.query(createdOrderQuery, [orderId]);
            const createdOrder = createdOrderResult.rows[0];
            if (createdOrder) {
                const createdItemsQuery = `SELECT ${getItemSelectClause()} FROM order_items oi WHERE oi.orderid = $1`;
                const createdItemsResult = await client.query(createdItemsQuery, [orderId]);
                createdOrder.items = createdItemsResult.rows || [];
                res.status(201).json(createdOrder);
            } else {
                res.status(500).json({ message: 'Order created but failed to retrieve details immediately after.' });
            }
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
            next(err);
        } finally {
            client.release();
        }
    },

    async getOrders(req, res, next) {
        const { date, driverName } = req.query;
        const TARGET_TIMEZONE = 'Asia/Bangkok';
        let baseQuery = `SELECT ${getOrderSelectClause()} FROM orders o`;
        const params = [];
        const conditions = [];
        let paramIndex = 1;
        if (driverName) {
            conditions.push(`o.drivername = $${paramIndex++}`);
            params.push(driverName);
        }
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            conditions.push(`o.createdat >= (($${paramIndex})::date)::timestamp AT TIME ZONE $${paramIndex + 1}`);
            conditions.push(`o.createdat < (($${paramIndex}::date + INTERVAL '1 day')::timestamp AT TIME ZONE $${paramIndex + 1})`);
            params.push(date);
            params.push(TARGET_TIMEZONE);
            paramIndex += 2;
        }
        if (conditions.length > 0) baseQuery += ' WHERE ' + conditions.join(' AND ');
        baseQuery += ' ORDER BY o.createdat DESC';
        try {
            const ordersResult = await db.query(baseQuery, params);
            const orders = ordersResult.rows;
            let resultsWithItems = [];
            if (orders.length > 0) {
                const orderIds = orders.map(o => o.id);
                const allItemsQuery = `SELECT ${getItemSelectClause()} FROM order_items oi WHERE oi.orderid = ANY($1::bigint[])`;
                const allItemsResult = await db.query(allItemsQuery, [orderIds]);
                const itemsByOrderId = allItemsResult.rows.reduce((acc, item) => {
                    (acc[item.orderId] = acc[item.orderId] || []).push(item);
                    return acc;
                }, {});
                resultsWithItems = orders.map(order => ({
                    ...order,
                    items: itemsByOrderId[order.id] || []
                }));
            }
            res.json(resultsWithItems);
        } catch (err) {
            next(err);
        }
    },

    async getTodayOrders(req, res, next) {
        const targetTimezone = 'Asia/Bangkok';
        try {
            const ordersQuery = `
            WITH today_local AS (
                SELECT DATE_TRUNC('day', NOW() AT TIME ZONE $1) AS midnight_local
            ),
            today_boundaries AS (
                SELECT
                    (tl.midnight_local AT TIME ZONE $1) AS start_of_today,
                    ((tl.midnight_local + INTERVAL '1 day') AT TIME ZONE $1) AS start_of_tomorrow
                FROM today_local tl
            )
            SELECT ${getOrderSelectClause()}
            FROM orders o
            CROSS JOIN today_boundaries tb
            WHERE o.createdat >= tb.start_of_today
            AND o.createdat < tb.start_of_tomorrow
            ORDER BY o.createdat DESC;`;
            const ordersResult = await db.query(ordersQuery, [targetTimezone]);
            const orders = ordersResult.rows;
            let ordersWithItems = [];
            if (orders.length > 0) {
                const orderIds = orders.map(o => o.id);
                const itemsQuery = `SELECT ${getItemSelectClause('')} FROM order_items oi WHERE oi.orderid = ANY($1::bigint[])`;
                const itemsResult = await db.query(itemsQuery, [orderIds]);
                const itemsByOrderId = itemsResult.rows.reduce((acc, item) => {
                    (acc[item.orderId] = acc[item.orderId] || []).push(item);
                    return acc;
                }, {});
                ordersWithItems = orders.map(order => ({
                    ...order,
                    items: itemsByOrderId[order.id] || []
                }));
            }
            const dataString = JSON.stringify(ordersWithItems);
            const currentEtag = crypto.createHash('md5').update(dataString).digest('hex');
            const quotedEtag = `"${currentEtag}"`;
            const incomingEtag = req.headers['if-none-match'];
            if (incomingEtag && incomingEtag === quotedEtag) {
                return res.status(304).end();
            }
            res.setHeader('ETag', quotedEtag);
            res.json(ordersWithItems);
        } catch (err) {
            next(err);
        }
    },

    async getOrder(req, res, next) {
        const { id } = req.params;
        if (!/^\d+$/.test(id)) return res.status(400).json({ message: 'Invalid order ID format. Must be an integer.' });
        const orderId = parseInt(id, 10);
        try {
            const orderQuery = `SELECT ${getOrderSelectClause()} FROM orders o WHERE o.id = $1`;
            const orderResult = await db.query(orderQuery, [orderId]);
            const order = orderResult.rows[0];
            if (!order) return res.status(404).json({ message: 'Order not found' });
            const itemsQuery = `SELECT ${getItemSelectClause()} FROM order_items oi WHERE oi.orderid = $1`;
            const itemsResult = await db.query(itemsQuery, [orderId]);
            order.items = itemsResult.rows || [];
            res.json(order);
        } catch (err) {
            next(err);
        }
    },

    async updateOrder(req, res, next) {
        const { id } = req.params;
        if (!/^\d+$/.test(id)) return res.status(400).json({ message: 'Invalid order ID format. Must be an integer.' });
        const orderId = parseInt(id, 10);
        const { customerName, status, driverName, paymentType, orderItems } = req.body;
        if (orderItems !== undefined && !Array.isArray(orderItems)) return res.status(400).json({ message: 'If provided, orderItems must be an array' });
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const checkOrderResult = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
            if (checkOrderResult.rows.length === 0) throw new Error('Order not found');
            const currentStatus = checkOrderResult.rows[0].status;
            const orderUpdates = [];
            const orderParams = [];
            let paramIndex = 1;
            if (customerName !== undefined) { orderUpdates.push(`customername = $${paramIndex++}`); orderParams.push(customerName); }
            if (driverName !== undefined) { orderUpdates.push(`drivername = $${paramIndex++}`); orderParams.push(driverName); }
            if (paymentType !== undefined) {
                const allowedTypes = ['Cash', 'Debit', 'Credit', null];
                if (allowedTypes.includes(paymentType)) { orderUpdates.push(`paymenttype = $${paramIndex++}`); orderParams.push(paymentType); }
            }
            if (status !== undefined && status !== currentStatus) {
                orderUpdates.push(`status = $${paramIndex++}`);
                orderParams.push(status);
                orderUpdates.push(`statusupdatedat = $${paramIndex++}`);
                orderParams.push(new Date());
            }
            if (orderUpdates.length > 0) {
                orderParams.push(orderId);
                const updateOrderSql = `UPDATE orders SET ${orderUpdates.join(', ')} WHERE id = $${paramIndex}`;
                await client.query(updateOrderSql, orderParams);
            }
            if (Array.isArray(orderItems)) {
                await client.query('DELETE FROM order_items WHERE orderid = $1', [orderId]);
                const insertItemSql = 'INSERT INTO order_items (orderid, producttype, quantity, priceperunit, totalamount) VALUES ($1, $2, $3, $4, $5)';
                const itemInsertPromises = [];
                for (const item of orderItems) {
                    const quantity = parseFloat(item.quantity);
                    const pricePerUnit = parseFloat(item.pricePerUnit);
                    if (isNaN(quantity) || isNaN(pricePerUnit) || quantity <= 0 || pricePerUnit < 0 || !item.productType || item.productType === 'N/A') continue;
                    const totalAmount = quantity * pricePerUnit;
                    const itemValues = [orderId, item.productType, quantity, pricePerUnit, totalAmount];
                    itemInsertPromises.push(client.query(insertItemSql, itemValues));
                }
                await Promise.all(itemInsertPromises);
            }
            await client.query('COMMIT');
            const updatedOrderQuery = `SELECT ${getOrderSelectClause()} FROM orders o WHERE o.id = $1`;
            const updatedOrderResult = await client.query(updatedOrderQuery, [orderId]);
            const updatedOrder = updatedOrderResult.rows[0];
            if (updatedOrder) {
                const updatedItemsQuery = `SELECT ${getItemSelectClause()} FROM order_items oi WHERE oi.orderid = $1`;
                const updatedItemsResult = await client.query(updatedItemsQuery, [orderId]);
                updatedOrder.items = updatedItemsResult.rows || [];
                res.json({ message: 'Order updated successfully', order: updatedOrder });
            } else {
                res.status(500).json({ message: 'Order updated but failed to retrieve final details' });
            }
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
            next(err);
        } finally {
            client.release();
        }
    },

    async deleteOrder(req, res, next) {
        const orderIdStr = req.params.id;
        if (!/^\d+$/.test(orderIdStr)) return res.status(400).json({ message: 'Invalid order ID format' });
        const orderId = parseInt(orderIdStr, 10);
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM order_items WHERE orderid = $1', [orderId]);
            const deleteOrderResult = await client.query('DELETE FROM orders WHERE id = $1', [orderId]);
            if (deleteOrderResult.rowCount === 0) throw new Error('Order not found');
            await client.query('COMMIT');
            return res.status(200).json({ message: 'Order deleted successfully' });
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
            next(err);
        } finally {
            client.release();
        }
    }
};
