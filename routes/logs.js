// routes/logs.js (Refactored for PostgreSQL + Aliases)
const express = require('express');
const router = express.Router();
// Use the PostgreSQL connection pool module
const db = require('../db/postgres');
// Assuming authMiddleware works without modification for now
const { authMiddleware, requireRole } = require('../middleware/auth');

// GET /api/logs?userId=&orderId=&action=
router.get('/', authMiddleware, requireRole(['admin', 'manager']), async (req, res) => { // Use async handler
    const { userId, orderId, action } = req.query;
    console.log("Received GET /api/logs request with query:", req.query);

    // Add aliases for columns to return camelCase
    // Assuming lowercase column names in DB: userid, orderid, action, details, timestamp
    let sql = `
        SELECT id, userid AS "userId", orderid AS "orderId", action, details, timestamp
        FROM activity_logs
        WHERE 1=1`; // Alias added
    const params = [];
    let paramIndex = 1; // Start parameter index for pg

    if (userId) {
        if (/^\d+$/.test(userId)) {
            sql += ` AND userid = $${paramIndex++}`; // Filter on actual column name
            params.push(parseInt(userId, 10));
        } else {
             console.warn(`Invalid userId parameter ignored: ${userId}`);
        }
    }
    if (orderId) {
         if (/^\d+$/.test(orderId)) {
            sql += ` AND orderid = $${paramIndex++}`; // Filter on actual column name
            params.push(parseInt(orderId, 10));
         } else {
             console.warn(`Invalid orderId parameter ignored: ${orderId}`);
         }
    }
    if (action) {
        sql += ` AND action = $${paramIndex++}`; // Filter on actual column name
        params.push(action);
    }

    sql += ' ORDER BY timestamp DESC'; // Order by actual column name

    try {
        console.log("Executing logs query:", sql, params);
        const result = await db.query(sql, params);
        // Result rows will have camelCase keys due to aliases
        const logs = result.rows;
        console.log(`Fetched ${logs.length} log entries.`);
        res.json(logs);
    } catch (err) {
        console.error("Error fetching activity logs:", err);
        res.status(500).json({ message: 'Failed to fetch activity logs' });
    }
});

module.exports = router;
