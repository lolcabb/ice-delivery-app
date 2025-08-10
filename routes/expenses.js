// ice-delivery-app/routes/expenses.js
const express = require('express');
const router = express.Router();
const { query, getClient } = require('../db/postgres'); // Ensure getClient is exported for transactions
const { authMiddleware, requireRole } = require('../middleware/auth');
const errorHandler = require('../middleware/errorHandler');

const { Storage } = require('@google-cloud/storage');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

const { getConfig } = require('../config/index.js');
const { GCS_BUCKET_NAME } = getConfig();

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Initialize Google Cloud Storage (reuse existing bucket)
const gcs = new Storage();
const bucket = gcs.bucket(GCS_BUCKET_NAME);


// Helper function for uploading expense receipts to GCS
const uploadExpenseReceiptToGCS = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            return resolve(null);
        }

        // Create a unique filename with expense folder structure
        const fileName = `expenses/receipts/receipt-${Date.now()}-${uuidv4()}.jpeg`;
        const blob = bucket.file(fileName);
        const blobStream = blob.createWriteStream({
            resumable: false,
            contentType: 'image/jpeg'
        });

        blobStream.on('error', (err) => reject(err));

        blobStream.on('finish', () => {
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
            console.log(`Successfully uploaded expense receipt to GCS: ${publicUrl}`);
            resolve(publicUrl);
        });

        // Image optimization with Sharp
        sharp(file.buffer)
            .resize({ width: 800, withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer()
            .then(processedBuffer => {
                blobStream.end(processedBuffer);
            })
            .catch(err => {
                reject(err);
            });
    });
};

router.uploadExpenseReceiptToGCS = uploadExpenseReceiptToGCS;

// --- Helper function to get dates based on Thailand timezone ---
const getThailandDateStrings = () => {
    //toLocaleString with en-US and Asia/Bangkok gets the current time in Thailand
    const nowInThailand = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    
    //toLocaleDateString with en-CA formats it as YYYY-MM-DD
    const todayYYYYMMDD = nowInThailand.toLocaleDateString('en-CA');

    const firstDayCurrentMonth = new Date(nowInThailand.getFullYear(), nowInThailand.getMonth(), 1)
        .toLocaleDateString('en-CA');

    // Corrected logic for last month's dates
    const lastMonthDate = new Date(nowInThailand.getFullYear(), nowInThailand.getMonth(), 0); // Day 0 of current month is last day of previous month
    const lastDayLastMonth = lastMonthDate.toLocaleDateString('en-CA');
    const firstDayLastMonth = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1)
        .toLocaleDateString('en-CA');
        
    const firstDayCurrentYear = new Date(nowInThailand.getFullYear(), 0, 1)
        .toLocaleDateString('en-CA');

    return {
        todayYYYYMMDD,
        firstDayCurrentMonth,
        firstDayLastMonth,
        lastDayLastMonth,
        firstDayCurrentYear
    };
};

async function updatePettyCashTotalForDate(logDate, dbQueryFn) {
    try {
        console.log(`[PettyCashUpdate] Recalculating petty cash total for date: ${logDate}`);
        const expensesResult = await dbQueryFn(
            'SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses WHERE COALESCE(paid_date, expense_date) = $1 AND is_petty_cash_expense = TRUE',
            [logDate]
        );
        const total_daily_petty_expenses = parseFloat(expensesResult.rows[0]?.total_expenses || 0);

        const updateLogResult = await dbQueryFn(
            'UPDATE petty_cash_log SET total_daily_petty_expenses = $1, updated_at = NOW() WHERE log_date = $2 RETURNING *',
            [total_daily_petty_expenses, logDate]
        );

        if (updateLogResult.rowCount > 0) {
            console.log(`[PettyCashUpdate] Successfully updated petty cash log for ${logDate}. New total: ${total_daily_petty_expenses}`);
        } else {
            console.log(`[PettyCashUpdate] No petty_cash_log entry found for ${logDate} to update its total, or total was already correct.`);
        }
    } catch (error) {
        console.error(`[PettyCashUpdate] Error updating petty cash total for ${logDate}:`, error);
        // Do not re-throw here, to avoid breaking the main transaction if this is a secondary operation.
    }
}

// GET /api/expenses/dashboard/enhanced-summary
router.get('/dashboard/enhanced-summary', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res, next) => {
    try {
        const { todayYYYYMMDD, firstDayCurrentMonth, firstDayLastMonth, lastDayLastMonth, firstDayCurrentYear } = getThailandDateStrings();

        // Calculate quarterly dates (3 months ago)
        const nowInThailand = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
        const threeMonthsAgo = new Date(nowInThailand.getFullYear(), nowInThailand.getMonth() - 3, 1);
        const firstDayThreeMonthsAgo = threeMonthsAgo.toLocaleDateString('en-CA');

        // Calculate YoY dates (same month last year)
        const lastYearSameMonth = new Date(nowInThailand.getFullYear() - 1, nowInThailand.getMonth(), 1);
        const firstDayLastYearSameMonth = lastYearSameMonth.toLocaleDateString('en-CA');
        const lastDayLastYearSameMonth = new Date(nowInThailand.getFullYear() - 1, nowInThailand.getMonth() + 1, 0).toLocaleDateString('en-CA');

        // Execute all queries in parallel
        const [
            // Current period totals
            totalExpensesTodayResult,
            totalExpensesThisMonthResult,
            totalExpensesLastMonthResult,
            totalExpensesYearToDateResult,

            // Payment method breakdown for current month
            bankTransferThisMonthResult,
            pettyCashThisMonthResult,

            // Petty cash details
            latestPettyCashResult,
            pettyCashReconciliationResult,

            // Historical comparisons
            quarterlyAverageResult,
            lastYearSameMonthResult,

            // Category analysis
            categoryAveragesResult,
            
            // Additional metrics
            activeCategoriesResult,
            totalTransactionsResult,
            dailyAverageResult

        ] = await Promise.all([
            // Current totals
            query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE COALESCE(paid_date, expense_date) = $1", [todayYYYYMMDD]),
            query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE COALESCE(paid_date, expense_date) >= $1", [firstDayCurrentMonth]),
            query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE COALESCE(paid_date, expense_date) >= $1 AND COALESCE(paid_date, expense_date) <= $2", [firstDayLastMonth, lastDayLastMonth]),
            query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE COALESCE(paid_date, expense_date) >= $1", [firstDayCurrentYear]),

            // Payment method breakdown
            query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE COALESCE(paid_date, expense_date) >= $1 AND is_petty_cash_expense = FALSE", [firstDayCurrentMonth]),
            query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE COALESCE(paid_date, expense_date) >= $1 AND is_petty_cash_expense = TRUE", [firstDayCurrentMonth]),

            // Petty cash status
            query(`SELECT 
                    closing_balance,
                    opening_balance,
                    cash_received_amount,
                    total_daily_petty_expenses,
                    log_date,
                    (opening_balance + cash_received_amount - total_daily_petty_expenses) as calculated_closing,
                    ABS(closing_balance - (opening_balance + cash_received_amount - total_daily_petty_expenses)) as variance
                   FROM petty_cash_log 
                   ORDER BY log_date DESC LIMIT 1`),
            query(`SELECT 
                    COUNT(*) as total_logs,
                    SUM(CASE WHEN ABS(closing_balance - (opening_balance + cash_received_amount - total_daily_petty_expenses)) <= 1 THEN 1 ELSE 0 END) as reconciled_logs
                   FROM petty_cash_log 
                   WHERE log_date >= $1`, [firstDayCurrentMonth]),

            // Historical comparisons
            query(`SELECT AVG(monthly_total) as quarterly_avg
                   FROM (
                       SELECT DATE_TRUNC('month', COALESCE(paid_date, expense_date)) as month, SUM(amount) as monthly_total
                       FROM expenses
                       WHERE COALESCE(paid_date, expense_date) >= $1 AND COALESCE(paid_date, expense_date) < $2
                       GROUP BY DATE_TRUNC('month', COALESCE(paid_date, expense_date))
                   ) monthly_totals`, [firstDayThreeMonthsAgo, firstDayCurrentMonth]),
            query("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE COALESCE(paid_date, expense_date) >= $1 AND COALESCE(paid_date, expense_date) <= $2", [firstDayLastYearSameMonth, lastDayLastYearSameMonth]),

            // Category analysis vs historical averages
            query(`WITH category_averages AS (
                       SELECT
                           e.category_id,
                           ec.category_name,
                           AVG(monthly_amount) as avg_amount
                       FROM expense_categories ec
                       LEFT JOIN (
                           SELECT
                               category_id,
                               DATE_TRUNC('month', COALESCE(paid_date, expense_date)) as month,
                               SUM(amount) as monthly_amount
                           FROM expenses
                           WHERE COALESCE(paid_date, expense_date) >= $1 AND COALESCE(paid_date, expense_date) < $2
                           GROUP BY category_id, DATE_TRUNC('month', COALESCE(paid_date, expense_date))
                       ) e ON ec.category_id = e.category_id
                       WHERE ec.is_active = TRUE
                       GROUP BY e.category_id, ec.category_name
                   ),
                   current_month_totals AS (
                       SELECT
                           e.category_id,
                           ec.category_name,
                           COALESCE(SUM(e.amount), 0) as current_amount
                       FROM expense_categories ec
                       LEFT JOIN expenses e ON ec.category_id = e.category_id AND COALESCE(e.paid_date, e.expense_date) >= $3
                       WHERE ec.is_active = TRUE
                       GROUP BY e.category_id, ec.category_name
                   )
                   SELECT
                       ca.category_name,
                       COALESCE(ca.avg_amount, 0) as historical_average,
                       COALESCE(cmt.current_amount, 0) as current_amount,
                       CASE
                           WHEN ca.avg_amount > 0 THEN
                               ((cmt.current_amount - ca.avg_amount) / ca.avg_amount) * 100
                           ELSE 0
                       END as variance_percent
                   FROM category_averages ca
                   LEFT JOIN current_month_totals cmt ON ca.category_name = cmt.category_name
                   WHERE ca.avg_amount > 0 OR cmt.current_amount > 0
                   ORDER BY ABS(CASE WHEN ca.avg_amount > 0 THEN ((cmt.current_amount - ca.avg_amount) / ca.avg_amount) * 100 ELSE 0 END) DESC`,
                   [firstDayThreeMonthsAgo, firstDayCurrentMonth, firstDayCurrentMonth]),

            // Additional metrics
            query("SELECT COUNT(*) as total FROM expense_categories WHERE is_active = TRUE"),
            query("SELECT COUNT(*) as total FROM expenses WHERE COALESCE(paid_date, expense_date) >= $1", [firstDayCurrentMonth]),
            query(`SELECT AVG(daily_total) as avg_daily
                   FROM (
                       SELECT COALESCE(paid_date, expense_date) as expense_date, SUM(amount) as daily_total
                       FROM expenses
                       WHERE COALESCE(paid_date, expense_date) >= $1
                       GROUP BY COALESCE(paid_date, expense_date)
                   ) daily_sums`, [firstDayCurrentMonth])
        ]);

        // Process results
        const totalExpensesToday = parseFloat(totalExpensesTodayResult.rows[0].total);
        const totalExpensesThisMonth = parseFloat(totalExpensesThisMonthResult.rows[0].total);
        const totalExpensesLastMonth = parseFloat(totalExpensesLastMonthResult.rows[0].total);
        const totalBankTransferThisMonth = parseFloat(bankTransferThisMonthResult.rows[0].total);
        const totalPettyCashThisMonth = parseFloat(pettyCashThisMonthResult.rows[0].total);
        const quarterlyAverage = parseFloat(quarterlyAverageResult.rows[0]?.quarterly_avg || 0);
        const lastYearSameMonthTotal = parseFloat(lastYearSameMonthResult.rows[0].total);

        // Calculate trends
        const momChange = totalExpensesLastMonth > 0 ? 
            ((totalExpensesThisMonth - totalExpensesLastMonth) / totalExpensesLastMonth) * 100 : 0;
        const yoyChange = lastYearSameMonthTotal > 0 ? 
            ((totalExpensesThisMonth - lastYearSameMonthTotal) / lastYearSameMonthTotal) * 100 : 0;

        // Process petty cash status
        let pettyCashStatus = 'reconciled';
        let pettyCashVariance = 0;
        let pettyCashBalance = 0;
        let pettyCashDaysRemaining = 0;

        if (latestPettyCashResult.rows.length > 0) {
            const pettyCashData = latestPettyCashResult.rows[0];
            pettyCashBalance = parseFloat(pettyCashData.closing_balance);
            pettyCashVariance = parseFloat(pettyCashData.variance);
            
            if (pettyCashVariance > 10) pettyCashStatus = 'discrepancy';
            else if (pettyCashVariance > 1) pettyCashStatus = 'pending';

            // Calculate days remaining
            const averageDaily = totalPettyCashThisMonth > 0 ? totalPettyCashThisMonth / nowInThailand.getDate() : 0;
            pettyCashDaysRemaining = averageDaily > 0 ? Math.floor(pettyCashBalance / averageDaily) : 0;
        }

        // Process category variances
        const categoryData = categoryAveragesResult.rows;
        const categoriesAboveAverage = categoryData
            .filter(cat => parseFloat(cat.variance_percent) > 10)
            .map(cat => ({
                name: cat.category_name,
                variance: parseFloat(cat.variance_percent),
                amount: parseFloat(cat.current_amount)
            }))
            .slice(0, 5);

        const categoriesBelowAverage = categoryData
            .filter(cat => parseFloat(cat.variance_percent) < -10)
            .map(cat => ({
                name: cat.category_name,
                variance: parseFloat(cat.variance_percent),
                amount: parseFloat(cat.current_amount)
            }))
            .slice(0, 5);

        // Build response matching your existing structure but with enhancements
        res.json({
            // Existing fields (for compatibility)
            expensesToday: totalExpensesToday,
            totalExpensesThisMonth: totalExpensesThisMonth,
            totalExpensesLastMonth: totalExpensesLastMonth,
            totalCategoriesActive: parseInt(activeCategoriesResult.rows[0].total),
            recentPettyCashClosing: pettyCashBalance,

            // Enhanced fields
            totalBankTransferThisMonth: totalBankTransferThisMonth,
            totalPettyCashThisMonth: totalPettyCashThisMonth,
            
            // Trend data
            momChange: momChange,
            yoyChange: yoyChange,
            quarterlyAverage: quarterlyAverage,
            
            // Petty cash enhanced data
            pettyCashBalance: pettyCashBalance,
            pettyCashReconciliationStatus: pettyCashStatus,
            pettyCashVariance: pettyCashVariance,
            pettyCashDaysRemaining: pettyCashDaysRemaining,
            
            // Category insights
            categoriesAboveAverage: categoriesAboveAverage,
            categoriesBelowAverage: categoriesBelowAverage,
            
            // Additional metrics
            totalTransactionsThisMonth: parseInt(totalTransactionsResult.rows[0].total),
            averageDailySpend: parseFloat(dailyAverageResult.rows[0]?.avg_daily || 0),
            totalExpensesYearToDate: parseFloat(totalExpensesYearToDateResult.rows[0].total)
        });

    } catch (err) {
        next(err);
    }
});

// --- Dashboard Endpoints (with corrected date logic using getThailandDateStrings) ---
// GET /api/expenses/dashboard/summary-cards
router.get('/dashboard/summary-cards', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res, next) => {
    try {
        const { todayYYYYMMDD, firstDayCurrentMonth, firstDayLastMonth, lastDayLastMonth } = getThailandDateStrings();

        const totalExpensesTodayResult = await query(
            "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE COALESCE(paid_date, expense_date) = $1",
            [todayYYYYMMDD] // Use today's date
        );
        const totalExpensesThisMonthResult = await query(
            "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE COALESCE(paid_date, expense_date) >= $1",
            [firstDayCurrentMonth]
        );
        const totalExpensesLastMonthResult = await query(
            "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE COALESCE(paid_date, expense_date) >= $1 AND COALESCE(paid_date, expense_date) <= $2",
            [firstDayLastMonth, lastDayLastMonth]
        );
        const activeCategoriesResult = await query(
            "SELECT COUNT(*) as total FROM expense_categories WHERE is_active = TRUE"
        );
        const recentPettyCashResult = await query(
            "SELECT closing_balance FROM petty_cash_log ORDER BY log_date DESC LIMIT 1"
        );

        res.json({
            expensesToday: parseFloat(totalExpensesTodayResult.rows[0].total),
            totalExpensesThisMonth: parseFloat(totalExpensesThisMonthResult.rows[0].total),
            totalExpensesLastMonth: parseFloat(totalExpensesLastMonthResult.rows[0].total),
            totalCategoriesActive: parseInt(activeCategoriesResult.rows[0].total),
            recentPettyCashClosing: recentPettyCashResult.rows.length > 0 ? parseFloat(recentPettyCashResult.rows[0].closing_balance) : 0
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/expenses/dashboard/expenses-by-category
router.get('/dashboard/expenses-by-category', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res, next) => {
    const period = req.query.period || 'current_month';
    let startDate;
    let endDate; 

    const { firstDayCurrentMonth, firstDayLastMonth, lastDayLastMonth, firstDayCurrentYear } = getThailandDateStrings();

    if (period === 'current_month') {
        startDate = firstDayCurrentMonth;
    } else if (period === 'last_month') {
        startDate = firstDayLastMonth;
        endDate = lastDayLastMonth;
    } else if (period === 'year_to_date') {
        startDate = firstDayCurrentYear;
    } else { // Default
        startDate = firstDayCurrentMonth; 
    }

    try {
        let queryText = `
            SELECT ec.category_name, COALESCE(SUM(e.amount), 0) as total_amount
            FROM expenses e
            JOIN expense_categories ec ON e.category_id = ec.category_id
            WHERE COALESCE(e.paid_date, e.expense_date) >= $1 AND ec.is_active = TRUE`;
        const queryParams = [startDate];

        if (period === 'last_month' && endDate) {
            queryText += ' AND COALESCE(e.paid_date, e.expense_date) <= $2';
            queryParams.push(endDate);
        }
        
        queryText += ` GROUP BY ec.category_name ORDER BY total_amount DESC`;

        const result = await query(queryText, queryParams);
        res.json(result.rows.map(row => ({...row, total_amount: parseFloat(row.total_amount)})));
    } catch (err) {
        next(err);
    }
});

// GET /api/expenses/dashboard/monthly-trend
router.get('/dashboard/monthly-trend', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res, next) => {
    const monthsCount = parseInt(req.query.months) || 6;
    try {
        const nowInThailand = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
        const startDateForTrend = new Date(nowInThailand.getFullYear(), nowInThailand.getMonth() - (monthsCount - 1), 1);
        const startDateString = startDateForTrend.toLocaleDateString('en-CA');

        const result = await query(
            `SELECT
                TO_CHAR(COALESCE(paid_date, expense_date), 'YYYY-MM') as month_year,
                COALESCE(SUM(amount), 0) as total_expenses
             FROM expenses
             WHERE COALESCE(paid_date, expense_date) >= $1::date
             GROUP BY TO_CHAR(COALESCE(paid_date, expense_date), 'YYYY-MM')
             ORDER BY month_year ASC`,
            [startDateString]
        );
        res.json(result.rows.map(row => ({
            month: new Date(row.month_year + '-01T00:00:00Z').toLocaleDateString('en-CA', { month: 'short', year: 'numeric' }),
            total_expenses: parseFloat(row.total_expenses)
        })));
    } catch (err) {
        next(err);
    }
});


// --- Existing Endpoints to be kept ---
// GET /api/expenses/dashboard/recent-expenses (keep as is)
router.get('/dashboard/recent-expenses', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res, next) => {
    const limit = parseInt(req.query.limit) || 5;
    try {
        const result = await query(
            `SELECT
                e.expense_id,
                e.expense_date,
                e.paid_date,
                e.description,
                e.amount,
                e.payment_method,
                e.is_petty_cash_expense,
                ec.category_name
             FROM expenses e
             JOIN expense_categories ec ON e.category_id = ec.category_id
             ORDER BY COALESCE(e.paid_date, e.expense_date) DESC, e.created_at DESC
             LIMIT $1`,
            [limit]
        );
        res.json(result.rows.map(row => ({ ...row, amount: parseFloat(row.amount)})));
    } catch (err) {
        next(err);
    }
});

// GET /api/expenses/reports/detailed (keep as is)
router.get('/reports/detailed', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res, next) => {
    const { startDate, endDate, paidStartDate, paidEndDate, category_id, payment_method, is_petty_cash_expense, user_id } = req.query;
    let sqlQuery = `
        SELECT
            e.expense_id, e.expense_date, e.paid_date, ec.category_name, e.description, e.amount,
            e.payment_method, e.reference_details, e.is_petty_cash_expense,
            u.username as recorded_by, e.created_at as recorded_at
        FROM expenses e
        JOIN expense_categories ec ON e.category_id = ec.category_id
        LEFT JOIN users u ON e.user_id = u.id`;
    const conditions = []; const values = []; let paramCount = 1;
    if (startDate) { conditions.push(`e.expense_date >= $${paramCount++}`); values.push(startDate); }
    if (endDate) { conditions.push(`e.expense_date <= $${paramCount++}`); values.push(endDate); }
    if (paidStartDate) { conditions.push(`e.paid_date >= $${paramCount++}`); values.push(paidStartDate); }
    if (paidEndDate) { conditions.push(`e.paid_date <= $${paramCount++}`); values.push(paidEndDate); }
    if (category_id) { conditions.push(`e.category_id = $${paramCount++}`); values.push(parseInt(category_id)); }
    if (payment_method) { conditions.push(`e.payment_method ILIKE $${paramCount++}`); values.push(`%${payment_method}%`); }
    if (is_petty_cash_expense !== undefined && is_petty_cash_expense !== '') {
        conditions.push(`e.is_petty_cash_expense = $${paramCount++}`);
        values.push(is_petty_cash_expense === 'true');
    }
    if (user_id) { conditions.push(`e.user_id = $${paramCount++}`); values.push(parseInt(user_id)); }
    if (conditions.length > 0) { sqlQuery += ' WHERE ' + conditions.join(' AND '); }
    sqlQuery += ` ORDER BY COALESCE(e.paid_date, e.expense_date) ASC, e.created_at ASC`;
    try {
        const result = await query(sqlQuery, values);
        const totalAmountResult = await query(
            `SELECT COALESCE(SUM(e.amount), 0) as grand_total FROM expenses e ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}`, values);
        res.json({
            reportData: result.rows.map(row => ({...row, amount: parseFloat(row.amount)})),
            summary: {
                grandTotal: parseFloat(totalAmountResult.rows[0].grand_total),
                numberOfEntries: result.rows.length,
                filtersApplied: req.query 
            }
        });
    } catch (err) { next(err); }
});

// Expense Categories Endpoints (keep as is)
router.get('/expense-categories', authMiddleware, async (req, res, next) => {
    try {
        const result = await query('SELECT * FROM expense_categories WHERE is_active = TRUE ORDER BY category_name ASC');
        res.json(result.rows);
    } catch (err) { next(err); }
});
router.post('/expense-categories', authMiddleware, requireRole(['admin', 'accountant']), async (req, res, next) => {
    const { category_name, description } = req.body;
    const created_by_user_id = req.user.id;
    if (!category_name) return res.status(400).json({ error: 'Category name is required' });
    try {
        const result = await query('INSERT INTO expense_categories (category_name, description, created_by_user_id) VALUES ($1, $2, $3) RETURNING *', [category_name, description, created_by_user_id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return next(err);
        next(err);
    }
});
router.put('/expense-categories/:id', authMiddleware, requireRole(['admin', 'accountant']), async (req, res, next) => {
    const categoryId = parseInt(req.params.id);
    const { category_name, description, is_active } = req.body;
    if (isNaN(categoryId)) return res.status(400).json({ error: 'Invalid category ID' });
    if (!category_name) return res.status(400).json({ error: 'Category name is required' });
    try {
        const result = await query('UPDATE expense_categories SET category_name = $1, description = $2, is_active = $3, updated_at = NOW() WHERE category_id = $4 RETURNING *', [category_name, description, is_active === undefined ? true : is_active, categoryId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Expense category not found' });
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return next(err);
        next(err);
    }
});
router.delete('/expense-categories/:id', authMiddleware, requireRole(['admin', 'accountant']), async (req, res, next) => {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) return res.status(400).json({ error: 'Invalid category ID' });
    try {
        const result = await query('UPDATE expense_categories SET is_active = FALSE, updated_at = NOW() WHERE category_id = $1 RETURNING *', [categoryId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Expense category not found' });
        res.json({ message: 'Expense category deactivated successfully', category: result.rows[0] });
    } catch (err) { next(err); }
});


// --- Petty Cash Log Endpoints ---
// GET /api/expenses/petty-cash (keep existing, pagination already present)
router.get('/petty-cash', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res, next) => {
    const { startDate, endDate, page = 1, limit = 15 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let mainQuery = 'SELECT pcl.*, u.username as user_managed_by FROM petty_cash_log pcl LEFT JOIN users u ON pcl.user_id = u.id';
    let countQuery = 'SELECT COUNT(*) FROM petty_cash_log pcl';
    const filterConditions = []; const filterValues = []; let paramIndex = 1;
    if (startDate) { filterConditions.push(`pcl.log_date >= $${paramIndex++}`); filterValues.push(startDate); }
    if (endDate) { filterConditions.push(`pcl.log_date <= $${paramIndex++}`); filterValues.push(endDate); }
    if (filterConditions.length > 0) { const whereClause = ' WHERE ' + filterConditions.join(' AND '); mainQuery += whereClause; countQuery += whereClause; }
    mainQuery += ` ORDER BY pcl.log_date DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const mainQueryValues = [...filterValues, parseInt(limit), parseInt(offset)];
    try {
        const result = await query(mainQuery, mainQueryValues);
        const countResult = await query(countQuery, filterValues);
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / parseInt(limit));
        res.json({ data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), totalItems, totalPages } });
    } catch (err) { next(err); }
});

// POST /api/expenses/petty-cash (Modified to use helper for initial total calculation)
router.post('/petty-cash', authMiddleware, requireRole(['admin', 'accountant']), async (req, res, next) => {
    const { log_date, opening_balance, cash_received_description, cash_received_amount, notes } = req.body;
    const user_id = req.user.id;
    if (!log_date || opening_balance === undefined) return res.status(400).json({ error: 'Log date and opening balance are required' });
    if (isNaN(parseFloat(opening_balance))) return res.status(400).json({ error: 'Invalid opening balance' });
    
    const client = await getClient();
    try {
        await client.query('BEGIN');
        // Calculate initial total_daily_petty_expenses
        const expensesResult = await client.query('SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses WHERE COALESCE(paid_date, expense_date) = $1 AND is_petty_cash_expense = TRUE', [log_date]);
        const total_daily_petty_expenses = parseFloat(expensesResult.rows[0]?.total_expenses || 0);

        const result = await client.query(
            `INSERT INTO petty_cash_log (log_date, opening_balance, cash_received_description, cash_received_amount, total_daily_petty_expenses, notes, user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [log_date, parseFloat(opening_balance), cash_received_description, parseFloat(cash_received_amount || 0), total_daily_petty_expenses, notes, user_id]
        );
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return next(err);
        next(err);
    } finally {
        client.release();
    }
});

// GET /api/expenses/petty-cash/:log_date (keep as is)
router.get('/petty-cash/:log_date', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res, next) => {
    const { log_date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(log_date)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    try {
        const result = await query('SELECT pcl.*, u.username as user_managed_by FROM petty_cash_log pcl LEFT JOIN users u ON pcl.user_id = u.id WHERE pcl.log_date = $1', [log_date]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Petty cash log for this date not found' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});


// PUT /api/expenses/petty-cash/:log_date (Modified to always recalculate total)
router.put('/petty-cash/:log_date', authMiddleware, requireRole(['admin', 'accountant']), async (req, res, next) => {
    const { log_date: original_log_date } = req.params;

    // **MODIFICATION**: Destructure the potentially new date and opening_balance from the body
    const { 
        log_date: new_log_date, // This is the new date from the form
        opening_balance,
        cash_received_description, 
        cash_received_amount, 
        notes, 
        reimbursement_requested_amount, 
        reimbursement_approved_amount, 
        reimbursement_date 
    } = req.body;
    const currentUserRole = req.user.role; // Get role from auth middleware

    if (!/^\d{4}-\d{2}-\d{2}$/.test(original_log_date)) return res.status(400).json({ error: 'Invalid date format for log_date. Use YYYY-MM-DD.' });
    
    const client = await getClient();
    try {
        await client.query('BEGIN');

        // --- **FIX**: Cast the timestamp column to a date for the WHERE clause ---
        const logCheck = await client.query('SELECT log_id FROM petty_cash_log WHERE log_date::date = $1', [original_log_date]);
        if (logCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: `Petty cash log for date ${original_log_date} not found.` });
        }
        // --- End of Fix ---

        const fieldsToUpdate = []; const values = []; let paramCount = 1;

        // --- **MODIFICATION**: Conditionally allow updating protected fields for admins ---
        if (currentUserRole === 'admin') {
            if (new_log_date) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(new_log_date)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Invalid new date format provided. Use YYYY-MM-DD.' });
                }
                fieldsToUpdate.push(`log_date = $${paramCount++}`);
                values.push(new_log_date);
            }
            if (opening_balance !== undefined) {
                fieldsToUpdate.push(`opening_balance = $${paramCount++}`);
                values.push(parseFloat(opening_balance || 0));
            }
        }
        // --- End of Modification ---

        if (cash_received_description !== undefined) { fieldsToUpdate.push(`cash_received_description = $${paramCount++}`); values.push(cash_received_description); }
        if (cash_received_amount !== undefined) { fieldsToUpdate.push(`cash_received_amount = $${paramCount++}`); values.push(parseFloat(cash_received_amount || 0)); } // Allow setting to 0
        if (notes !== undefined) { fieldsToUpdate.push(`notes = $${paramCount++}`); values.push(notes); }
        if (reimbursement_requested_amount !== undefined) { fieldsToUpdate.push(`reimbursement_requested_amount = $${paramCount++}`); values.push(parseFloat(reimbursement_requested_amount || 0)); }
        if (reimbursement_approved_amount !== undefined) { fieldsToUpdate.push(`reimbursement_approved_amount = $${paramCount++}`); values.push(parseFloat(reimbursement_approved_amount || 0)); }
        if (reimbursement_date !== undefined) { fieldsToUpdate.push(`reimbursement_date = $${paramCount++}`); values.push(reimbursement_date || null); } // Allow setting to null
        
        if (fieldsToUpdate.length > 0) {
            fieldsToUpdate.push(`updated_at = NOW()`);
            values.push(original_log_date);
            // **FINAL FIX**: Also cast the date in the UPDATE's WHERE clause.
            const sqlQuery = `UPDATE petty_cash_log SET ${fieldsToUpdate.join(', ')} WHERE log_date::date = $${paramCount} RETURNING *`;
            
            await client.query(sqlQuery, values);
        }
        
        // Always run the recalculation
        await updatePettyCashTotalForDate(new_log_date || original_log_date, client.query.bind(client));
        if (new_log_date && new_log_date !== original_log_date) {
            await updatePettyCashTotalForDate(original_log_date, client.query.bind(client));
        }

        await client.query('COMMIT');
        
        const finalResult = await query('SELECT * FROM petty_cash_log WHERE log_date::date = $1', [new_log_date || original_log_date]);
        res.json(finalResult.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return next(err);
        next(err);
    } finally {
        client.release();
    }
});

// POST /api/expenses/petty-cash/:log_date/reconcile (Modified to use helper)
router.post('/petty-cash/:log_date/reconcile', authMiddleware, requireRole(['admin', 'accountant']), async (req, res, next) => {
    const { log_date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(log_date)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const logExists = await client.query('SELECT log_id FROM petty_cash_log WHERE log_date = $1', [log_date]);
        if (logExists.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Petty cash log for this date not found. Create it first.' });
        }
        
        await updatePettyCashTotalForDate(log_date, client.query.bind(client)); // Use the helper
        
        await client.query('COMMIT');
        const updatedLog = await query('SELECT * FROM petty_cash_log WHERE log_date = $1', [log_date]); // Fetch the updated log
        res.json({ message: 'Petty cash log reconciled successfully', log: updatedLog.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

// --- Expenses Endpoints (Modified for Petty Cash Reconciliation) ---
// POST /api/expenses
router.post('/', authMiddleware, requireRole(['admin', 'accountant', 'manager']), upload.single('receipt_file'), async (req, res, next) => {
    const { expense_date, paid_date, category_id, description, amount, payment_method, reference_details, is_petty_cash_expense, related_document_url } = req.body;
    const pettyCash = String(is_petty_cash_expense).toLowerCase() === 'true';
    const user_id_who_recorded = req.user.id;

    if (!expense_date || !category_id || !description || amount === undefined) {
        return res.status(400).json({ error: 'Expense date, category, description, and amount are required' });
    }
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { 
        return res.status(400).json({ error: 'Invalid amount' });
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        //Upload File to GCS if provided
        const receipt_file_url = await router.uploadExpenseReceiptToGCS(req.file);

        const effectivePaidDate = paid_date || expense_date;

        const result = await client.query(
            `INSERT INTO expenses (expense_date, paid_date, category_id, description, amount, payment_method, reference_details, is_petty_cash_expense, related_document_url, user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [
                expense_date,
                effectivePaidDate,
                parseInt(category_id),
                description,
                parseFloat(amount),
                payment_method,
                reference_details,
                pettyCash,
                receipt_file_url || related_document_url,
                user_id_who_recorded
            ]
        );

        const newExpense = result.rows[0];
        if (newExpense.is_petty_cash_expense) {
            await updatePettyCashTotalForDate(newExpense.paid_date || newExpense.expense_date, client.query.bind(client));
        }
        await client.query('COMMIT');
        res.status(201).json(newExpense);
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

// GET /api/expenses/:id
router.get('/:id', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res, next) => {
    const expenseId = parseInt(req.params.id);
    if (isNaN(expenseId)) return res.status(400).json({ error: 'Invalid expense ID' });
    try {
        const result = await query(`SELECT e.*, ec.category_name FROM expenses e JOIN expense_categories ec ON e.category_id = ec.category_id WHERE e.expense_id = $1`, [expenseId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// PUT /api/expenses/:id
router.put('/:id', authMiddleware, requireRole(['admin', 'accountant', 'manager']), upload.single('receipt_file'), async (req, res, next) => {
    const expenseId = parseInt(req.params.id);
    const { expense_date, paid_date, category_id, description, amount, payment_method, reference_details, is_petty_cash_expense, related_document_url } = req.body;
    const pettyCash = String(is_petty_cash_expense).toLowerCase() === 'true';

    if (isNaN(expenseId)) return res.status(400).json({ error: 'Invalid expense ID' });
    if (!expense_date || !category_id || !description || amount === undefined) return res.status(400).json({ error: 'Expense date, category, description, and amount are required' });
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const client = await getClient();
    try {
        await client.query('BEGIN');
        const oldExpenseResult = await client.query('SELECT expense_date, paid_date, is_petty_cash_expense, related_document_url FROM expenses WHERE expense_id = $1', [expenseId]);
        if (oldExpenseResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Expense not found' }); }
        const oldExpense = oldExpenseResult.rows[0];
        const oldExpenseDate = (oldExpense.paid_date || oldExpense.expense_date).toISOString().split('T')[0];
        const oldIsPettyCash = oldExpense.is_petty_cash_expense;

        // Upload new file if provided, otherwise keep existing url or ise provided url
        let final_document_url = oldExpense.related_document_url;
        if(req.file) {
            final_document_url = await router.uploadExpenseReceiptToGCS(req.file);
        } else if(related_document_url !== undefined) {
            final_document_url = related_document_url;
        }

        const effectivePaidDate = paid_date || expense_date;

        const result = await client.query(
            `UPDATE expenses
             SET expense_date = $1, paid_date = $2, category_id = $3, description = $4, amount = $5, payment_method = $6,
                 reference_details = $7, is_petty_cash_expense = $8, related_document_url = $9, updated_at = NOW()
             WHERE expense_id = $10 RETURNING *`,
            [
                expense_date,
                effectivePaidDate,
                parseInt(category_id),
                description,
                parseFloat(amount),
                payment_method,
                reference_details,
                pettyCash,
                final_document_url,
                expenseId
            ]
        );
        const updatedExpense = result.rows[0];
        const newIsPettyCash = updatedExpense.is_petty_cash_expense;
        const newExpenseDate = updatedExpense.paid_date || updatedExpense.expense_date; // This is already YYYY-MM-DD

        // If new state is petty cash, update its date's total
        if (newIsPettyCash) {
            await updatePettyCashTotalForDate(newExpenseDate, client.query.bind(client));
        }
        // If date changed AND old state was petty cash, update old date's total
        if (oldIsPettyCash && oldExpenseDate !== newExpenseDate) {
            await updatePettyCashTotalForDate(oldExpenseDate, client.query.bind(client));
        }
        // If it was petty cash and now it is not, update the old date's total
        if (oldIsPettyCash && !newIsPettyCash) {
            await updatePettyCashTotalForDate(oldExpenseDate, client.query.bind(client));
        }

        await client.query('COMMIT');
        res.json(updatedExpense);
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

// DELETE /api/expenses/:id
router.delete('/:id', authMiddleware, requireRole(['admin', 'accountant']), async (req, res, next) => {
    const expenseId = parseInt(req.params.id);
    if (isNaN(expenseId)) return res.status(400).json({ error: 'Invalid expense ID' });

    const client = await getClient();
    try {
        await client.query('BEGIN');
        const expenseDataResult = await client.query('SELECT expense_date, paid_date, is_petty_cash_expense FROM expenses WHERE expense_id = $1', [expenseId]);
        if (expenseDataResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Expense not found' }); }

        const { expense_date, paid_date, is_petty_cash_expense } = expenseDataResult.rows[0];
        const dateString = (paid_date || expense_date).toISOString().split('T')[0]; // Format to YYYY-MM-DD

        const result = await client.query('DELETE FROM expenses WHERE expense_id = $1 RETURNING *', [expenseId]);
        
        if (is_petty_cash_expense) {
            await updatePettyCashTotalForDate(dateString, client.query.bind(client));
        }

        await client.query('COMMIT');
        res.json({ message: 'Expense deleted successfully', expense: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

// GET /api/expenses (List expenses - keep as is)
router.get('/', authMiddleware, requireRole(['admin', 'accountant', 'manager']), async (req, res, next) => {
    const { startDate, endDate, paidStartDate, paidEndDate, category_id, user_id, payment_method, is_petty_cash_expense, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sqlQuery = `SELECT e.*, ec.category_name FROM expenses e JOIN expense_categories ec ON e.category_id = ec.category_id`;
    const conditions = []; const values = []; let paramCount = 1;
    if (startDate) { conditions.push(`e.expense_date >= $${paramCount++}`); values.push(startDate); }
    if (endDate) { conditions.push(`e.expense_date <= $${paramCount++}`); values.push(endDate); }
    if (paidStartDate) { conditions.push(`e.paid_date >= $${paramCount++}`); values.push(paidStartDate); }
    if (paidEndDate) { conditions.push(`e.paid_date <= $${paramCount++}`); values.push(paidEndDate); }
    if (category_id) { conditions.push(`e.category_id = $${paramCount++}`); values.push(parseInt(category_id)); }
    if (user_id) { conditions.push(`e.user_id = $${paramCount++}`); values.push(parseInt(user_id)); }
    if (payment_method) { conditions.push(`e.payment_method ILIKE $${paramCount++}`); values.push(`%${payment_method}%`); }
    if (is_petty_cash_expense !== undefined && is_petty_cash_expense !== '') {
        conditions.push(`e.is_petty_cash_expense = $${paramCount++}`);
        values.push(is_petty_cash_expense === 'true');
    }
    if (conditions.length > 0) { sqlQuery += ' WHERE ' + conditions.join(' AND '); }
    let countQuery = `SELECT COUNT(*) FROM expenses e ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}`;
    const countValues = [...values];
    sqlQuery += ` ORDER BY COALESCE(e.paid_date, e.expense_date) DESC, e.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(parseInt(limit), parseInt(offset));
    try {
        const result = await query(sqlQuery, values);
        const countResult = await query(countQuery, countValues); 
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / parseInt(limit));
        res.json({
            data: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), totalItems, totalPages }
        });
    } catch (err) { next(err); }
});

router.use(errorHandler);

module.exports = router;
module.exports.uploadExpenseReceiptToGCS = uploadExpenseReceiptToGCS;