// 📁 File: routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../db/database'); // Assuming db setup is correct

// --- DELETE Order ---
router.delete('/orders/:id', (req, res) => {
  const orderId = req.params.id;
  console.log(`Received DELETE /api/orders/${orderId}`);
  if (!/^\d+$/.test(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID format' });
  }
  try {
    const deleteTx = db.transaction(() => {
        console.log(`Deleting items for order ${orderId}`);
        db.prepare('DELETE FROM order_items WHERE orderId = ?').run(orderId);
        console.log(`Deleting order ${orderId}`);
        const result = db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
        console.log(`Delete result for order ${orderId}:`, result);
        if (result.changes === 0) { throw new Error('Order not found'); }
    });
    deleteTx();
    console.log(`Successfully deleted order ${orderId}`);
    return res.status(200).json({ message: 'Order deleted successfully' });
  } catch (err) {
    console.error(`Error deleting order ${orderId}:`, err);
    if (err.message === 'Order not found') { return res.status(404).json({ message: 'Order not found' }); }
    return res.status(500).json({ message: 'Failed to delete order on the server' });
  }
});

// --- Daily Financial Report ---
router.get('/reports/daily', (req, res) => {
  const date = req.query.date;
  console.log(`Received GET /api/reports/daily request for date: ${date}`);

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'Valid date query parameter (YYYY-MM-DD) is required' });
  }

  try {
    const sql = `
      SELECT
        COUNT(DISTINCT o.id) AS totalOrders,
        SUM(CASE WHEN oi.orderId IS NOT NULL THEN oi.totalAmount ELSE 0 END) AS totalRevenue,
        SUM(CASE WHEN o.paymentType = 'Cash' AND oi.orderId IS NOT NULL THEN oi.totalAmount ELSE 0 END) AS cashSales,
        SUM(CASE WHEN o.paymentType = 'Debit' AND oi.orderId IS NOT NULL THEN oi.totalAmount ELSE 0 END) AS debitSales,
        SUM(CASE WHEN o.paymentType = 'Credit' AND oi.orderId IS NOT NULL THEN oi.totalAmount ELSE 0 END) AS creditSales,
        SUM(CASE WHEN o.paymentType IS NULL AND oi.orderId IS NOT NULL THEN oi.totalAmount ELSE 0 END) AS unspecifiedSales
      FROM orders o
      LEFT JOIN order_items oi ON oi.orderId = o.id
      WHERE date(o.createdAt) = ?
    `;
    console.log("Executing Daily Report SQL:", sql, date); // Log SQL
    const summary = db.prepare(sql).get(date);

    // --- NEW: Log raw summary from DB ---
    console.log("Raw daily summary from DB:", summary);
    // --- END NEW ---

    // Ensure defaults if no orders found for that day
    const result = {
        date,
        totalOrders: summary?.totalOrders ?? 0,
        totalRevenue: summary?.totalRevenue ?? 0,
        cashSales: summary?.cashSales ?? 0,
        debitSales: summary?.debitSales ?? 0,
        creditSales: summary?.creditSales ?? 0,
        unspecifiedSales: summary?.unspecifiedSales ?? 0,
    };

    console.log("Sending Daily report summary:", result);
    return res.json(result);

  } catch (err) {
    console.error(`Error fetching daily report for ${date}:`, err);
    return res.status(500).json({ message: 'Failed to fetch daily report' });
  }
});

// --- Monthly Financial Report ---
router.get('/reports/monthly', (req, res) => {
  const month = req.query.month; // format YYYY-MM
  console.log(`Received GET /api/reports/monthly request for month: ${month}`);

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: 'Valid month query parameter (YYYY-MM) is required' });
  }

  try {
    // Aggregate daily totals for the specified month
    const sql = `
      SELECT
        date(o.createdAt) AS date,
        COUNT(DISTINCT o.id) AS orderCount,
        SUM(CASE WHEN oi.orderId IS NOT NULL THEN oi.totalAmount ELSE 0 END) AS totalAmount,
        SUM(CASE WHEN o.paymentType = 'Cash' AND oi.orderId IS NOT NULL THEN oi.totalAmount ELSE 0 END) AS cashSales,
        SUM(CASE WHEN o.paymentType = 'Debit' AND oi.orderId IS NOT NULL THEN oi.totalAmount ELSE 0 END) AS debitSales,
        SUM(CASE WHEN o.paymentType = 'Credit' AND oi.orderId IS NOT NULL THEN oi.totalAmount ELSE 0 END) AS creditSales,
        SUM(CASE WHEN o.paymentType IS NULL AND oi.orderId IS NOT NULL THEN oi.totalAmount ELSE 0 END) AS unspecifiedSales
      FROM orders o
      LEFT JOIN order_items oi ON oi.orderId = o.id
      WHERE strftime('%Y-%m', o.createdAt) = ?
      GROUP BY date(o.createdAt)
      ORDER BY date(o.createdAt)
    `;
    console.log("Executing Monthly Report SQL:", sql, month); // Log SQL
    const rows = db.prepare(sql).all(month);

    // --- NEW: Log raw rows from DB ---
    console.log(`Raw monthly rows from DB for ${month}:`, rows);
    // --- END NEW ---

    // Calculate overall totals for the month
    const monthlySummary = rows.reduce((acc, row) => {
        acc.totalOrders += row.orderCount;
        acc.totalRevenue += row.totalAmount;
        acc.cashSales += row.cashSales;
        acc.debitSales += row.debitSales;
        acc.creditSales += row.creditSales;
        acc.unspecifiedSales += row.unspecifiedSales;
        return acc;
    }, { totalOrders: 0, totalRevenue: 0, cashSales: 0, debitSales: 0, creditSales: 0, unspecifiedSales: 0 });

    // --- NEW: Log calculated summary ---
    console.log(`Calculated monthly summary for ${month}:`, monthlySummary);
    // --- END NEW ---

    return res.json({
        month,
        dailyData: rows, // Array of daily summaries
        summary: monthlySummary // Overall totals for the month
    });

  } catch (err) {
    console.error(`Error fetching monthly report for ${month}:`, err);
    return res.status(500).json({ message: 'Failed to fetch monthly report' });
  }
});

module.exports = router;
