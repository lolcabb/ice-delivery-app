// 📁 File: reports.js (Corrected Version)
const express = require('express');
const router = express.Router();
// Ensure you have the correct path to your PostgreSQL connection pool module
const db = require('../db/postgres');
// date-fns is not strictly required by this version but might be useful elsewhere
// const { format, startOfMonth, endOfMonth } = require('date-fns');

// Define the target timezone for report boundaries
const targetTimezone = 'Asia/Bangkok'; // UTC+7 for Thailand 

// Helper function to get today's date in YYYY-MM-DD format
function getTodayDateString() {
    // Using JS Date().toLocaleDateString with en-CA locale consistently gives YYYY-MM-DD
    return new Date().toLocaleDateString('en-CA');
}

// Helper function to get current month in YYYY-MM format
function getCurrentMonthString() {
    const now = new Date();
    // Get month (0-11), add 1, pad with '0' if needed
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
}


// --- Daily Financial Report ---
// GET /api/reports/daily?date=YYYY-MM-DD
router.get('/daily', async (req, res) => {
    const dateParam = req.query.date || getTodayDateString();
    console.log(`Received GET /api/reports/daily request for date: ${dateParam}`);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    try {
        // Corrected SQL query
        const dailyReportSql = `
            WITH report_boundaries AS (
                SELECT
                    -- Correct: Cast date to timestamp BEFORE applying AT TIME ZONE
                    (($1::date)::timestamp AT TIME ZONE $2) AS start_of_day_tz,
                    (($1::date + INTERVAL '1 day')::timestamp AT TIME ZONE $2) AS start_of_next_day_tz
            ),
            order_totals AS (
                SELECT
                    orderid,
                    SUM(totalamount) AS order_total
                FROM order_items
                GROUP BY orderid
            )
            SELECT
                COUNT(o.id) AS "totalOrders",
                COALESCE(SUM(ot.order_total), 0) AS "totalRevenue",
                COALESCE(SUM(ot.order_total) FILTER (WHERE o.paymenttype = 'Cash'), 0) AS "cashSales",
                COALESCE(SUM(ot.order_total) FILTER (WHERE o.paymenttype = 'Debit'), 0) AS "debitSales",
                COALESCE(SUM(ot.order_total) FILTER (WHERE o.paymenttype = 'Credit'), 0) AS "creditSales",
                COALESCE(SUM(ot.order_total) FILTER (WHERE o.paymenttype IS NULL OR o.paymenttype NOT IN ('Cash', 'Debit', 'Credit')), 0) AS "unspecifiedSales"
            FROM orders o
            LEFT JOIN order_totals ot ON o.id = ot.orderid
            CROSS JOIN report_boundaries rb -- Use alias rb
            WHERE
                -- Correct: Compare against correctly named and calculated boundaries
                o.createdat >= rb.start_of_day_tz
            AND
                o.createdat < rb.start_of_next_day_tz;
        `;

        console.log("Executing Daily Report SQL (Correct Version):", dailyReportSql.trim().replace(/\s+/g, ' '), dateParam, targetTimezone);
        const result = await db.query(dailyReportSql, [dateParam, targetTimezone]);
        const reportData = result.rows[0];

        if (!reportData) {
             return res.json({ date: dateParam, totalOrders: 0, totalRevenue: 0, cashSales: 0, debitSales: 0, creditSales: 0, unspecifiedSales: 0 });
        }

        // Parse results...
        const finalReport = {
            date: dateParam,
            totalOrders: parseInt(reportData.totalOrders || 0, 10),
            totalRevenue: parseFloat(reportData.totalRevenue || 0),
            cashSales: parseFloat(reportData.cashSales || 0),
            debitSales: parseFloat(reportData.debitSales || 0),
            creditSales: parseFloat(reportData.creditSales || 0),
            unspecifiedSales: parseFloat(reportData.unspecifiedSales || 0),
        };

        console.log(`Generated daily report for ${dateParam}.`);
        res.json(finalReport);

    } catch (err) {
        console.error(`Error fetching daily report for ${dateParam}:`, err);
         if (err.code) {
            console.error(`PostgreSQL Error Code: ${err.code}`);
         }
        res.status(500).json({ message: 'Failed to fetch daily report' });
    }
});

// --- Monthly Financial Report ---
// GET /api/reports/monthly?month=YYYY-MM
router.get('/monthly', async (req, res) => {
    const monthParam = req.query.month || getCurrentMonthString();
    console.log(`Received GET /api/reports/monthly request for month: ${monthParam}`);

    if (!/^\d{4}-\d{2}$/.test(monthParam)) {
        return res.status(400).json({ message: 'Invalid month format. Use YYYY-MM.' });
    }

    try {
        // Corrected SQL query
        const monthlyReportSql = `
            WITH month_boundaries AS (
                SELECT
                    ( (date_trunc('month', $1::date))::timestamp AT TIME ZONE $2 ) AS start_of_month_tz,
                    ( (date_trunc('month', $1::date) + INTERVAL '1 month')::timestamp AT TIME ZONE $2 ) AS start_of_next_month_tz
            ),
            order_totals AS (
                SELECT
                    orderid,
                    SUM(totalamount) AS order_total
                FROM order_items
                GROUP BY orderid
            ),
            summary_calc AS (
                 SELECT
                    COUNT(o.id) AS "totalOrders",
                    COALESCE(SUM(ot.order_total), 0) AS "totalRevenue",
                    COALESCE(SUM(ot.order_total) FILTER (WHERE o.paymenttype = 'Cash'), 0) AS "cashSales",
                    COALESCE(SUM(ot.order_total) FILTER (WHERE o.paymenttype = 'Debit'), 0) AS "debitSales",
                    COALESCE(SUM(ot.order_total) FILTER (WHERE o.paymenttype = 'Credit'), 0) AS "creditSales",
                    COALESCE(SUM(ot.order_total) FILTER (WHERE o.paymenttype IS NULL OR o.paymenttype NOT IN ('Cash', 'Debit', 'Credit')), 0) AS "unspecifiedSales"
                FROM orders o
                LEFT JOIN order_totals ot ON o.id = ot.orderid
                CROSS JOIN month_boundaries mb
                WHERE
                    o.createdat >= mb.start_of_month_tz
                AND
                    o.createdat < mb.start_of_next_month_tz
            ),
            daily_calc AS (
                 SELECT
                    DATE(o.createdat AT TIME ZONE $2) AS report_date,
                    COUNT(o.id) AS "orderCount",
                    COALESCE(SUM(ot.order_total), 0) AS "totalAmount",
                    COALESCE(SUM(ot.order_total) FILTER (WHERE o.paymenttype = 'Cash'), 0) AS "cashSales",
                    COALESCE(SUM(ot.order_total) FILTER (WHERE o.paymenttype = 'Debit'), 0) AS "debitSales",
                    COALESCE(SUM(ot.order_total) FILTER (WHERE o.paymenttype = 'Credit'), 0) AS "creditSales",
                    COALESCE(SUM(ot.order_total) FILTER (WHERE o.paymenttype IS NULL OR o.paymenttype NOT IN ('Cash', 'Debit', 'Credit')), 0) AS "unspecifiedSales"
                FROM orders o
                LEFT JOIN order_totals ot ON o.id = ot.orderid
                CROSS JOIN month_boundaries mb
                WHERE
                    o.createdat >= mb.start_of_month_tz
                AND
                    o.createdat < mb.start_of_next_month_tz
                GROUP BY report_date
                ORDER BY report_date
            )
            SELECT
                (SELECT row_to_json(s.*) FROM summary_calc s) AS summary,
                (SELECT COALESCE(json_agg(d.* ORDER BY d.report_date), '[]'::json) FROM daily_calc d) AS "dailyData";
        `;

        console.log("Executing Monthly Report SQL (Correct Version):", monthlyReportSql.trim().replace(/\s+/g, ' '), monthParam, targetTimezone);
        const result = await db.query(monthlyReportSql, [monthParam + '-01', targetTimezone]);
        const reportData = result.rows[0];

        if (!reportData || !reportData.summary) {
             return res.json({ month: monthParam, summary: { totalOrders: 0, totalRevenue: 0, cashSales: 0, debitSales: 0, creditSales: 0, unspecifiedSales: 0 }, dailyData: [] });
        }

        // Parse numbers...
        const parsedSummary = {
            totalOrders: parseInt(reportData.summary.totalOrders || 0, 10),
            totalRevenue: parseFloat(reportData.summary.totalRevenue || 0),
            cashSales: parseFloat(reportData.summary.cashSales || 0),
            debitSales: parseFloat(reportData.summary.debitSales || 0),
            creditSales: parseFloat(reportData.summary.creditSales || 0),
            unspecifiedSales: parseFloat(reportData.summary.unspecifiedSales || 0),
        };
        const parsedDailyData = reportData.dailyData.map(d => ({
            date: d.report_date,
            orderCount: parseInt(d.orderCount || 0, 10),
            totalAmount: parseFloat(d.totalAmount || 0),
            cashSales: parseFloat(d.cashSales || 0),
            debitSales: parseFloat(d.debitSales || 0),
            creditSales: parseFloat(d.creditSales || 0),
            unspecifiedSales: parseFloat(d.unspecifiedSales || 0),
        }));
        const finalReport = { month: monthParam, summary: parsedSummary, dailyData: parsedDailyData };

        console.log(`Generated monthly report for ${monthParam}.`);
        res.json(finalReport);

    } catch (err) {
        console.error(`Error fetching monthly report for ${monthParam}:`, err);
         if (err.code) {
            console.error(`PostgreSQL Error Code: ${err.code}`);
         }
        res.status(500).json({ message: 'Failed to fetch monthly report' });
    }
});


// Export the router for use in your main application file
module.exports = router;