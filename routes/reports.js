const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { format } = require('date-fns');

// Helper: format date to YYYY-MM-DD
function formatDate(dateStr) {
  return format(new Date(dateStr), 'yyyy-MM-dd');
}

// GET /api/reports/end-of-day?date=YYYY-MM-DD
router.get('/end-of-day', authMiddleware, requireRole(['admin', 'manager']), (req, res) => {
    const dateParam = req.query.date || format(new Date(), 'yyyy-MM-dd');
  
    const rows = db.prepare(`
      SELECT 
        id,
        customerName,
        phone,
        productType,
        quantity,
        pricePerUnit,
        totalAmount,
        status,
        driverName,
        createdAt
      FROM orders
      WHERE DATE(createdAt) = DATE(?)
      ORDER BY driverName, createdAt
    `).all(dateParam);
  
    res.json({ date: dateParam, orders: rows });
  });
  

// GET /api/reports/credit-sales?date=YYYY-MM-DD&csv=true
router.get('/credit-sales', authMiddleware, requireRole(['admin', 'manager']), (req, res) => {
  const dateParam = req.query.date || format(new Date(), 'yyyy-MM-dd');
  const creditOrders = db.prepare(`
    SELECT id, customerName, phone, totalAmount, driverName, createdAt
    FROM orders
    WHERE status = 'Credit Sale' AND DATE(createdAt) = DATE(?)
    ORDER BY createdAt DESC
  `).all(dateParam);

  if (req.query.csv === 'true') {
    const header = 'Order ID,Customer Name,Phone,Amount,Driver,Time';
    const csv = creditOrders.map(o => [
      o.id, o.customerName, o.phone, o.totalAmount, o.driverName, o.createdAt
    ].join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=credit-sales-${dateParam}.csv`);
    return res.send(`${header}\n${csv}`);
  }

  res.json({ date: dateParam, creditSales: creditOrders });
});

module.exports = router;
