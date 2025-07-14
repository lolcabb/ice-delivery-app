// ice-delivery-app/routes/inventory.js
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

// === INVENTORY DASHBOARD (CONSUMABLES) ===
// GET /api/inventory/dashboard/consumables/summary
router.get('/dashboard/consumables/summary', authMiddleware, requireRole(['admin', 'accountant', 'manager', 'staff']), async (req, res) => {
    try {
        const lowStockResult = await query(
            "SELECT COUNT(*) as count FROM inventory_consumables WHERE current_stock_level <= reorder_point AND reorder_point IS NOT NULL"
        );
        const distinctItemsResult = await query(
            "SELECT COUNT(*) as count FROM inventory_consumables"
        );
        
        const mostActiveResult = await query(`
            SELECT ic.consumable_name, COUNT(icm.movement_id) as movement_count
            FROM inventory_consumable_movements icm
            JOIN inventory_consumables ic ON icm.consumable_id = ic.consumable_id
            WHERE icm.movement_type = 'out' AND icm.movement_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY ic.consumable_name
            ORDER BY movement_count DESC
            LIMIT 1
        `);

        res.json({
            lowStockItemsCount: parseInt(lowStockResult.rows[0]?.count || 0),
            distinctConsumableItems: parseInt(distinctItemsResult.rows[0]?.count || 0),
            mostActiveConsumable: mostActiveResult.rows[0] || { consumable_name: 'N/A', movement_count: 0 }
        });
    } catch (err) {
        handleError(res, err, "Failed to retrieve consumables dashboard summary");
    }
});

// GET /api/inventory/dashboard/consumables/recent-movements
router.get('/dashboard/consumables/recent-movements', authMiddleware, requireRole(['admin', 'accountant', 'manager', 'staff']), async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;
    try {
        const result = await query(
            `SELECT 
                icm.movement_id, 
                icm.movement_date, 
                icm.movement_type, 
                icm.quantity_changed, 
                icm.new_stock_level_after_movement,
                icm.notes,
                ic.consumable_name, 
                ic.unit_of_measure,
                u.username as recorded_by_username
             FROM inventory_consumable_movements icm
             JOIN inventory_consumables ic ON icm.consumable_id = ic.consumable_id
             LEFT JOIN users u ON icm.user_id = u.id
             ORDER BY icm.movement_date DESC, icm.movement_id DESC
             LIMIT $1`,
            [limit]
        );
        res.json(result.rows);
    } catch (err) {
        handleError(res, err, "Failed to retrieve recent consumable movements");
    }
});

// GET /api/inventory/dashboard/consumables/item-type-movement-trend
router.get('/dashboard/consumables/item-type-movement-trend', authMiddleware, requireRole(['admin', 'accountant', 'manager', 'staff']), async (req, res) => {
    const { item_type_id, period = 'last_7_days' } = req.query; 
    
    if (!item_type_id) {
        return res.status(400).json({ error: 'item_type_id is required.' });
    }

    let startDate;
    const today = new Date();
    today.setHours(0,0,0,0); 

    if (period === 'last_7_days') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 6); 
    } else if (period === 'last_30_days') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 29);
    } else {
        return res.status(400).json({ error: 'Invalid period specified. Use last_7_days or last_30_days.' });
    }

    try {
         const result = await query(
            `SELECT 
                TO_CHAR(m.movement_date, 'YYYY-MM-DD') as date,
                SUM(CASE WHEN m.movement_type = 'in' THEN m.quantity_changed 
                         WHEN m.movement_type = 'adjustment' AND m.quantity_changed > 0 THEN m.quantity_changed
                         ELSE 0 END) as total_in,
                SUM(CASE WHEN m.movement_type = 'out' THEN ABS(m.quantity_changed) 
                         WHEN m.movement_type = 'adjustment' AND m.quantity_changed < 0 THEN ABS(m.quantity_changed)
                         ELSE 0 END) as total_out
            FROM inventory_consumable_movements m
            JOIN inventory_consumables c ON m.consumable_id = c.consumable_id
            WHERE c.item_type_id = $1 AND m.movement_date >= $2 AND m.movement_date < $3
            GROUP BY TO_CHAR(m.movement_date, 'YYYY-MM-DD')
            ORDER BY date ASC`,
            [parseInt(item_type_id), startDate.toISOString().split('T')[0], new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0] ] 
        );

        res.json(result.rows.map(row => ({
            date: row.date,
            total_in: parseFloat(row.total_in),
            total_out: parseFloat(row.total_out)
        })));
    } catch (err) {
        handleError(res, err, "Failed to retrieve item type movement trend");
    }
});

// GET /api/inventory/dashboard/consumables/inventory-value
router.get('/dashboard/consumables/inventory-value', authMiddleware, requireRole(['admin', 'accountant', 'manager', 'staff']), async (req, res) => {
    try {
        // Get total inventory value (you'll need to add cost_per_unit to your inventory_consumables table)
        // For now, this is a placeholder - you can modify based on your cost tracking needs
        const valueResult = await query(`
            SELECT 
                SUM(ic.current_stock_level) as total_units,
                COUNT(ic.consumable_id) as total_items,
                SUM(CASE WHEN ic.current_stock_level <= COALESCE(ic.reorder_point, 0) THEN 1 ELSE 0 END) as low_stock_count,
                SUM(CASE WHEN ic.current_stock_level = 0 THEN 1 ELSE 0 END) as out_of_stock_count
            FROM inventory_consumables ic
        `);

        // Get movement statistics for today
        const todayMovementsResult = await query(`
            SELECT 
                COUNT(icm.movement_id) as total_movements_today,
                SUM(CASE WHEN icm.movement_type = 'in' THEN icm.quantity_changed ELSE 0 END) as total_in_today,
                SUM(CASE WHEN icm.movement_type = 'out' THEN ABS(icm.quantity_changed) ELSE 0 END) as total_out_today
            FROM inventory_consumable_movements icm
            WHERE DATE(icm.movement_date) = CURRENT_DATE
        `);

        // Get weekly consumption patterns
        const weeklyTrendResult = await query(`
            SELECT 
                DATE(icm.movement_date) as date,
                SUM(CASE WHEN icm.movement_type = 'in' THEN icm.quantity_changed ELSE 0 END) as daily_in,
                SUM(CASE WHEN icm.movement_type = 'out' THEN ABS(icm.quantity_changed) ELSE 0 END) as daily_out
            FROM inventory_consumable_movements icm
            WHERE icm.movement_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(icm.movement_date)
            ORDER BY date DESC
        `);

        const baseStats = valueResult.rows[0] || {};
        const todayStats = todayMovementsResult.rows[0] || {};
        const weeklyTrend = weeklyTrendResult.rows || [];

        res.json({
            inventory_summary: {
                total_units: parseInt(baseStats.total_units || 0),
                total_items: parseInt(baseStats.total_items || 0),
                low_stock_count: parseInt(baseStats.low_stock_count || 0),
                out_of_stock_count: parseInt(baseStats.out_of_stock_count || 0),
                estimated_value: parseInt(baseStats.total_units || 0) * 10 // Placeholder: 10 baht per unit average
            },
            today_activity: {
                total_movements: parseInt(todayStats.total_movements_today || 0),
                total_received: parseInt(todayStats.total_in_today || 0),
                total_used: parseInt(todayStats.total_out_today || 0),
                net_change: parseInt(todayStats.total_in_today || 0) - parseInt(todayStats.total_out_today || 0)
            },
            weekly_trend: weeklyTrend.map(day => ({
                date: day.date,
                received: parseInt(day.daily_in || 0),
                used: parseInt(day.daily_out || 0),
                net: parseInt(day.daily_in || 0) - parseInt(day.daily_out || 0)
            }))
        });
    } catch (err) {
        handleError(res, err, "Failed to retrieve inventory value summary");
    }
});

// GET /api/inventory/dashboard/consumables/usage-patterns
router.get('/dashboard/consumables/usage-patterns', authMiddleware, requireRole(['admin', 'accountant', 'manager', 'staff']), async (req, res) => {
    try {
        // Get items with highest usage in last 30 days
        const highUsageResult = await query(`
            SELECT 
                ic.consumable_name,
                ic.current_stock_level,
                ic.unit_of_measure,
                COUNT(icm.movement_id) as movement_count,
                SUM(CASE WHEN icm.movement_type = 'out' THEN ABS(icm.quantity_changed) ELSE 0 END) as total_used,
                AVG(CASE WHEN icm.movement_type = 'out' THEN ABS(icm.quantity_changed) ELSE 0 END) as avg_usage_per_transaction,
                ROUND(
                    SUM(CASE WHEN icm.movement_type = 'out' THEN ABS(icm.quantity_changed) ELSE 0 END) / 
                    GREATEST(DATE_PART('days', CURRENT_DATE - MIN(icm.movement_date)), 1), 
                    2
                ) as daily_usage_rate
            FROM inventory_consumables ic
            LEFT JOIN inventory_consumable_movements icm ON ic.consumable_id = icm.consumable_id 
                AND icm.movement_date >= CURRENT_DATE - INTERVAL '30 days'
                AND icm.movement_type = 'out'
            GROUP BY ic.consumable_id, ic.consumable_name, ic.current_stock_level, ic.unit_of_measure
            HAVING COUNT(icm.movement_id) > 0
            ORDER BY total_used DESC
            LIMIT 10
        `);

        // Get items that might run out soon (based on usage patterns)
        const riskAnalysisResult = await query(`
            WITH usage_stats AS (
                SELECT 
                    ic.consumable_id,
                    ic.consumable_name,
                    ic.current_stock_level,
                    ic.unit_of_measure,
                    ROUND(
                        COALESCE(
                            SUM(CASE WHEN icm.movement_type = 'out' THEN ABS(icm.quantity_changed) ELSE 0 END) / 
                            GREATEST(DATE_PART('days', CURRENT_DATE - MIN(icm.movement_date)), 1),
                            0
                        ), 
                        2
                    ) as daily_usage_rate
                FROM inventory_consumables ic
                LEFT JOIN inventory_consumable_movements icm ON ic.consumable_id = icm.consumable_id 
                    AND icm.movement_date >= CURRENT_DATE - INTERVAL '30 days'
                    AND icm.movement_type = 'out'
                GROUP BY ic.consumable_id, ic.consumable_name, ic.current_stock_level, ic.unit_of_measure
            )
            SELECT 
                consumable_name,
                current_stock_level,
                unit_of_measure,
                daily_usage_rate,
                CASE 
                    WHEN daily_usage_rate > 0 THEN ROUND(current_stock_level / daily_usage_rate, 1)
                    ELSE null
                END as estimated_days_remaining
            FROM usage_stats
            WHERE daily_usage_rate > 0
            ORDER BY 
                CASE 
                    WHEN daily_usage_rate > 0 THEN current_stock_level / daily_usage_rate
                    ELSE 999
                END ASC
            LIMIT 5
        `);

        res.json({
            high_usage_items: highUsageResult.rows.map(item => ({
                name: item.consumable_name,
                current_stock: parseInt(item.current_stock_level),
                unit: item.unit_of_measure,
                total_used_30d: parseInt(item.total_used || 0),
                daily_usage: parseFloat(item.daily_usage_rate || 0),
                avg_per_transaction: parseFloat(item.avg_usage_per_transaction || 0)
            })),
            risk_analysis: riskAnalysisResult.rows.map(item => ({
                name: item.consumable_name,
                current_stock: parseInt(item.current_stock_level),
                unit: item.unit_of_measure,
                daily_usage: parseFloat(item.daily_usage_rate || 0),
                estimated_days_remaining: parseFloat(item.estimated_days_remaining || 0)
            }))
        });
    } catch (err) {
        handleError(res, err, "Failed to retrieve usage patterns");
    }
});

// === INVENTORY ITEM TYPES ===
// (For categorizing consumables like "Packaging", "Cleaning Supplies", etc.)
router.get('/item-types', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => { // Staff/Manager might need to view types
    try {
        const result = await query('SELECT * FROM inventory_item_types ORDER BY type_name ASC');
        res.json(result.rows);
    } catch (err) {
        handleError(res, err, "Failed to retrieve inventory item types");
    }
});

router.post('/item-types', authMiddleware, requireRole(['admin', 'accountant']), async (req, res) => {
    const { type_name, description } = req.body;
    if (!type_name) {
        return res.status(400).json({ error: 'Type name is required' });
    }
    try {
        const result = await query(
            'INSERT INTO inventory_item_types (type_name, description) VALUES ($1, $2) RETURNING *',
            [type_name, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { 
            return handleError(res, err, `Inventory item type name '${type_name}' already exists.`, 409);
        }
        handleError(res, err, "Failed to create inventory item type");
    }
});

router.put('/item-types/:id', authMiddleware, requireRole(['admin', 'accountant']), async (req, res) => {
    const typeId = parseInt(req.params.id);
    const { type_name, description } = req.body;
    if (isNaN(typeId)) return res.status(400).json({ error: 'Invalid item type ID' });
    if (!type_name) return res.status(400).json({ error: 'Type name is required' });
    try {
        const result = await query(
            'UPDATE inventory_item_types SET type_name = $1, description = $2, updated_at = NOW() WHERE item_type_id = $3 RETURNING *',
            [type_name, description, typeId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Inventory item type not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { 
            return handleError(res, err, `Inventory item type name '${type_name}' already exists.`, 409);
        }
        handleError(res, err, "Failed to update inventory item type");
    }
});

router.delete('/item-types/:id', authMiddleware, requireRole(['admin', 'accountant']), async (req, res) => { // Allow accountant to delete if unused
    const typeId = parseInt(req.params.id);
    if (isNaN(typeId)) return res.status(400).json({ error: 'Invalid item type ID' });
    try {
        const consumablesCheck = await query('SELECT 1 FROM inventory_consumables WHERE item_type_id = $1 LIMIT 1', [typeId]);
        // Since ice_containers are removed from this system's scope, no need to check them here.
        if (consumablesCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Cannot delete item type. It is currently in use by consumable items.' });
        }
        const result = await query('DELETE FROM inventory_item_types WHERE item_type_id = $1 RETURNING *', [typeId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Inventory item type not found' });
        }
        res.json({ message: 'Inventory item type deleted successfully', itemType: result.rows[0] });
    } catch (err) {
        if (err.code === '23503') { 
             return handleError(res, err, 'Cannot delete item type. It is currently in use.', 400);
        }
        handleError(res, err, "Failed to delete inventory item type");
    }
});


// === INVENTORY CONSUMABLES (e.g., Packaging) ===
router.get('/consumables', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => { 
    const { page = 1, limit = 20, item_type_id, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let mainQuery = `SELECT ic.*, it.type_name FROM inventory_consumables ic JOIN inventory_item_types it ON ic.item_type_id = it.item_type_id`;
    let countQuery = `SELECT COUNT(ic.*) FROM inventory_consumables ic JOIN inventory_item_types it ON ic.item_type_id = it.item_type_id`;
    const conditions = []; const values = []; let paramIndex = 1;
    if (item_type_id) { conditions.push(`ic.item_type_id = $${paramIndex++}`); values.push(parseInt(item_type_id)); }
    if (search) { conditions.push(`(ic.consumable_name ILIKE $${paramIndex} OR ic.notes ILIKE $${paramIndex})`); values.push(`%${search}%`); paramIndex++; }
    if (conditions.length > 0) { const whereClause = ' WHERE ' + conditions.join(' AND '); mainQuery += whereClause; countQuery += whereClause; }
    mainQuery += ` ORDER BY ic.consumable_name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const mainQueryValues = [...values, parseInt(limit), parseInt(offset)];
    try {
        const result = await query(mainQuery, mainQueryValues);
        const countResult = await query(countQuery, values);
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / parseInt(limit));
        res.json({ data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), totalItems, totalPages } });
    } catch (err) { handleError(res, err, "Failed to retrieve inventory consumables"); }
});

router.get('/consumables/:id', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => { 
    const consumableId = parseInt(req.params.id);
    if (isNaN(consumableId)) return res.status(400).json({ error: 'Invalid consumable ID' });
    try {
        const result = await query(`SELECT ic.*, it.type_name FROM inventory_consumables ic JOIN inventory_item_types it ON ic.item_type_id = it.item_type_id WHERE ic.consumable_id = $1`, [consumableId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Inventory consumable not found' });
        res.json(result.rows[0]);
    } catch (err) { handleError(res, err, "Failed to retrieve inventory consumable"); }
});

router.post('/consumables', authMiddleware, requireRole(['admin', 'accountant', 'staff']), async (req, res) => {
    const { item_type_id, consumable_name, unit_of_measure, current_stock_level = 0, reorder_point, notes } = req.body;
    const user_id_created_by = req.user.id;
    if (!item_type_id || !consumable_name || !unit_of_measure) return res.status(400).json({ error: 'Item type, consumable name, and unit of measure are required' });
    if (current_stock_level !== undefined && isNaN(parseInt(current_stock_level))) return res.status(400).json({ error: 'Current stock level must be a number' });
    if (reorder_point !== undefined && reorder_point !== null && isNaN(parseInt(reorder_point))) return res.status(400).json({ error: 'Reorder point must be a number' });
    try {
        const result = await query(`INSERT INTO inventory_consumables (item_type_id, consumable_name, unit_of_measure, current_stock_level, reorder_point, notes, user_id_created_by, user_id_last_updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *`, [parseInt(item_type_id), consumable_name, unit_of_measure, parseInt(current_stock_level) || 0, reorder_point ? parseInt(reorder_point) : null, notes, user_id_created_by]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return handleError(res, err, `Consumable name '${consumable_name}' already exists.`, 409);
        if (err.code === '23503') return handleError(res, err, `Invalid item_type_id.`, 400);
        handleError(res, err, "Failed to create inventory consumable");
    }
});

router.put('/consumables/:id', authMiddleware, requireRole(['admin', 'accountant', 'staff']), async (req, res) => { 
    const consumableId = parseInt(req.params.id);
    const { item_type_id, consumable_name, unit_of_measure, reorder_point, notes } = req.body;
    const user_id_last_updated_by = req.user.id;
    if (isNaN(consumableId)) return res.status(400).json({ error: 'Invalid consumable ID' });
    if (!item_type_id || !consumable_name || !unit_of_measure) return res.status(400).json({ error: 'Item type, consumable name, and unit of measure are required' });
    if (reorder_point !== undefined && reorder_point !== null && isNaN(parseInt(reorder_point))) return res.status(400).json({ error: 'Reorder point must be a number' });
    try {
        const result = await query(`UPDATE inventory_consumables SET item_type_id = $1, consumable_name = $2, unit_of_measure = $3, reorder_point = $4, notes = $5, user_id_last_updated_by = $6, updated_at = NOW() WHERE consumable_id = $7 RETURNING *`, [parseInt(item_type_id), consumable_name, unit_of_measure, reorder_point ? parseInt(reorder_point) : null, notes, user_id_last_updated_by, consumableId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Inventory consumable not found' });
        res.json(result.rows[0]);
    } catch (err) {
         if (err.code === '23505') return handleError(res, err, `Consumable name '${consumable_name}' already exists.`, 409);
        if (err.code === '23503') return handleError(res, err, `Invalid item_type_id.`, 400);
        handleError(res, err, "Failed to update inventory consumable");
    }
});

router.delete('/consumables/:id', authMiddleware, requireRole(['admin', 'accountant']), async (req, res) => { 
    const consumableId = parseInt(req.params.id);
    if (isNaN(consumableId)) return res.status(400).json({ error: 'Invalid consumable ID' });
    try {
        const movementsCheck = await query('SELECT 1 FROM inventory_consumable_movements WHERE consumable_id = $1 LIMIT 1', [consumableId]);
        if (movementsCheck.rows.length > 0) return res.status(400).json({ error: 'Cannot delete consumable. It has associated stock movements. Consider deactivating it instead or clearing movements.' });
        const result = await query('DELETE FROM inventory_consumables WHERE consumable_id = $1 RETURNING *', [consumableId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Inventory consumable not found' });
        res.json({ message: 'Inventory consumable deleted successfully', consumable: result.rows[0] });
    } catch (err) {
        if (err.code === '23503') return handleError(res, err, 'Cannot delete consumable. It is referenced elsewhere (e.g., movements).', 400);
        handleError(res, err, "Failed to delete inventory consumable");
    }
});

// === INVENTORY CONSUMABLE MOVEMENTS ===
router.post('/consumables/:consumableId/movements', authMiddleware, requireRole(['admin', 'accountant', 'staff']), async (req, res) => {
    const consumableId = parseInt(req.params.consumableId);
    const { movement_type, quantity_changed, notes, movement_date } = req.body;
    const user_id = req.user.id;
    if (isNaN(consumableId)) return res.status(400).json({ error: 'Invalid consumable ID.' });
    if (!movement_type || !['in', 'out', 'adjustment'].includes(movement_type)) return res.status(400).json({ error: 'Invalid movement type. Must be "in", "out", or "adjustment".' });
    if (quantity_changed === undefined || isNaN(parseInt(quantity_changed))) return res.status(400).json({ error: 'Quantity changed is required and must be a number.' });
    const quantity = parseInt(quantity_changed);
    if (quantity === 0 && movement_type !== 'adjustment') return res.status(400).json({ error: 'Quantity changed cannot be zero for "in" or "out" movements.' });

        // --- **MODIFICATION**: Validate and set the date ---
    // If movement_date is provided, use it. Otherwise, default to now.
    const finalMovementDate = movement_date ? new Date(movement_date) : new Date();
    if (isNaN(finalMovementDate.getTime())) {
        return res.status(400).json({ error: 'Invalid movement_date format.' });
    }

    const client = await getClient(); 
    try {
        await client.query('BEGIN');
        const stockResult = await client.query('SELECT current_stock_level FROM inventory_consumables WHERE consumable_id = $1 FOR UPDATE', [consumableId]);
        if (stockResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Consumable item not found.' }); }
        const currentStock = parseInt(stockResult.rows[0].current_stock_level);
        let newStockLevel; let actualQuantityChanged = quantity;
        if (movement_type === 'in') {
            if (quantity <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Quantity for "in" movement must be positive.' }); }
            newStockLevel = currentStock + quantity;
        } else if (movement_type === 'out') {
            if (quantity <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Quantity for "out" movement must be positive (it will be deducted).' }); }
            if (currentStock < quantity) { await client.query('ROLLBACK'); return res.status(400).json({ error: `สต็อกไม่เพียงพอ สต็อกปัจจุบัน: ${currentStock}, พยายามจ่ายออก: ${quantity}.` }); }
            newStockLevel = currentStock - quantity; actualQuantityChanged = -Math.abs(quantity);
        } else { newStockLevel = currentStock + quantity; }
        await client.query('UPDATE inventory_consumables SET current_stock_level = $1, user_id_last_updated_by = $2, updated_at = NOW() WHERE consumable_id = $3', [newStockLevel, user_id, consumableId]);
        
        // --- **MODIFICATION**: Use the validated date in the INSERT statement ---
        const movementResult = await client.query(
            `INSERT INTO inventory_consumable_movements (consumable_id, movement_date, movement_type, quantity_changed, new_stock_level_after_movement, notes, user_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, 
            [consumableId, finalMovementDate, movement_type, actualQuantityChanged, newStockLevel, notes, user_id]
        );
        
        await client.query('COMMIT');
        res.status(201).json(movementResult.rows[0]);
    } catch (err) { await client.query('ROLLBACK'); handleError(res, err, "Failed to record stock movement");
    } finally { client.release(); }
});

router.get('/consumables/:consumableId/movements', authMiddleware, requireRole(['admin', 'accountant', 'staff', 'manager']), async (req, res) => { 
    const consumableId = parseInt(req.params.consumableId);
    const { page = 1, limit = 20, startDate, endDate, movement_type } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    if (isNaN(consumableId)) return res.status(400).json({ error: 'Invalid consumable ID.' });
    let mainQuery = `SELECT m.*, u.username as recorded_by_username FROM inventory_consumable_movements m LEFT JOIN users u ON m.user_id = u.id WHERE m.consumable_id = $1`;
    let countQuery = `SELECT COUNT(*) FROM inventory_consumable_movements WHERE consumable_id = $1`;
    const conditions = []; const values = [consumableId]; let paramIndex = 2; 
    if (startDate) { conditions.push(`m.movement_date >= $${paramIndex++}`); values.push(startDate); }
    if (endDate) { conditions.push(`m.movement_date <= $${paramIndex++}`); values.push(endDate); }
    if (movement_type) { conditions.push(`m.movement_type = $${paramIndex++}`); values.push(movement_type); }
    if (conditions.length > 0) { const whereClause = ' AND ' + conditions.join(' AND '); mainQuery += whereClause; countQuery += whereClause; }
    mainQuery += ` ORDER BY m.movement_date DESC, m.movement_id DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const mainQueryValues = [...values, parseInt(limit), parseInt(offset)];
    const countQueryValues = values.slice(0, paramIndex - 2);
    try {
        const result = await query(mainQuery, mainQueryValues);
        const countResult = await query(countQuery, countQueryValues);
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / parseInt(limit));
        res.json({ data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), totalItems, totalPages } });
    } catch (err) { handleError(res, err, "Failed to retrieve consumable movement history"); }
});

// Removed sections for:
// === ICE CONTAINER SIZES ===
// === RETURN REASONS ===
// === ICE CONTAINERS (Serialized Items) ===
// === ICE CONTAINER ASSIGNMENTS ===

module.exports = router;
