const db = require('../db/postgres');

const ALLOWED_SESSIONS = ['Morning', 'Afternoon'];

// Numeric validation ranges
const PH_RANGE = { min: 0, max: 14 };
const TDS_RANGE = { min: 0, max: 2000 };
const EC_RANGE = { min: 0, max: 5000 };
const HARDNESS_RANGE = { min: 0, max: 1000 };

const isValidNumber = (value, { min, max }) =>
    value == null ||
    (typeof value === 'number' && !isNaN(value) && value >= min && value <= max);

const isValidTimestamp = (value) => {
    const date = new Date(value);
    return !isNaN(date.getTime());
};

// Parse a date string (YYYY-MM-DD) into a UTC Date object
const parseUTCDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
};

// Get all water test logs filtered by a specific date
// Updated with proper ordering
exports.getAllWaterLogs = async (req, res) => {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: 'Valid date (YYYY-MM-DD) is required.' });
    }

    try {
        const query = `
            SELECT l.log_id, l.stage_id, s.stage_name, l.test_session,
                   l.ph_value, l.tds_ppm_value, l.ec_us_cm_value,
                   l.hardness_mg_l_caco3,
                   l.test_timestamp, u.username AS recorded_by
            FROM water_quality_logs l
            JOIN water_test_stages s ON l.stage_id = s.stage_id
            LEFT JOIN users u ON l.recorded_by_user_id = u.id
            WHERE DATE(l.test_timestamp) = $1
            ORDER BY s.stage_order, s.stage_id, 
                     CASE l.test_session 
                         WHEN 'Morning' THEN 1 
                         WHEN 'Afternoon' THEN 2 
                         ELSE 3 
                     END,
                     l.test_timestamp ASC
        `;
        const { rows } = await db.query(query, [date]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'No water test logs found' });
        }
        res.status(200).json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Upsert method for updating/inserting water logs
// The `date` field must be in 'YYYY-MM-DD' and interpreted in UTC.
// test_timestamp is generated in UTC at 08:00 or 14:00 based on the session; clients should omit it
exports.upsertWaterLogs = async (req, res) => {
    const { date, logs } = req.body;
    const recorded_by_user_id = req.user.id;
    
    try {
        // Validate input
        if (!date || !logs || !Array.isArray(logs) || !isValidTimestamp(`${date}T00:00:00Z`)) {
            return res.status(400).json({ message: 'Invalid input data' });
        }

        for (const logData of logs) {
            const {
                stage_id,
                test_session,
                ph_value = null,
                tds_ppm_value = null,
                ec_us_cm_value = null,
                hardness_mg_l_caco3 = null
            } = logData;

            if (!stage_id || !test_session) {
                return res.status(400).json({ message: 'Missing required fields: stage_id and test_session' });
            }

            if (!ALLOWED_SESSIONS.includes(test_session)) {
                return res.status(400).json({ message: `Unsupported test session: ${test_session}` });
            }

            if (
                !isValidNumber(ph_value, PH_RANGE) ||
                !isValidNumber(tds_ppm_value, TDS_RANGE) ||
                !isValidNumber(ec_us_cm_value, EC_RANGE) ||
                !isValidNumber(hardness_mg_l_caco3, HARDNESS_RANGE)
            ) {
                return res.status(400).json({ message: 'Invalid numeric values in logs' });
            }
        }

        // Start transaction
        await db.query('BEGIN');

        const upsertedLogs = [];

        for (const logData of logs) {
            const {
                stage_id,
                test_session,
                ph_value = null,
                tds_ppm_value = null,
                ec_us_cm_value = null,
                hardness_mg_l_caco3 = null
            } = logData;
            
            const [year, month, day] = date.split('-').map(Number);
            const hour = test_session === 'Morning' ? 8 : 14;
            const timestamp = new Date(Date.UTC(year, month - 1, day, hour)).toISOString();

            const query = `
                INSERT INTO water_quality_logs
                    (stage_id, test_session, test_timestamp, ph_value, tds_ppm_value, ec_us_cm_value, hardness_mg_l_caco3, recorded_by_user_id, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                ON CONFLICT ON CONSTRAINT water_quality_logs_stage_session_test_date_key
                DO UPDATE SET
                    ph_value = EXCLUDED.ph_value,
                    tds_ppm_value = EXCLUDED.tds_ppm_value,
                    ec_us_cm_value = EXCLUDED.ec_us_cm_value,
                    hardness_mg_l_caco3 = EXCLUDED.hardness_mg_l_caco3,
                    recorded_by_user_id = EXCLUDED.recorded_by_user_id,
                    updated_at = NOW()
                RETURNING *
            `;

            const { rows } = await db.query(query, [
                stage_id,
                test_session,
                timestamp,
                ph_value,
                tds_ppm_value,
                ec_us_cm_value,
                hardness_mg_l_caco3,
                recorded_by_user_id
            ]);

            upsertedLogs.push(rows[0]);
        }

        await db.query('COMMIT');
        res.status(200).json({
            message: 'Water logs updated successfully',
            logs: upsertedLogs
        });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Upsert error:', err.message);
        res.status(500).json({
            message: 'Server error during upsert',
            error: err.message
        });
    }
};

// Insert a new water test log
exports.addWaterLog = async (req, res) => {
    const {
        stage_id,
        test_session,
        test_timestamp,
        ph_value = null,
        tds_ppm_value = null,
        ec_us_cm_value = null,
        hardness_mg_l_caco3 = null
    } = req.body;

    const recorded_by_user_id = req.user.id;
    try {
        if (!ALLOWED_SESSIONS.includes(test_session)) {
            return res.status(400).json({ message: `Unsupported test session: ${test_session}` });
        }

        if (!isValidTimestamp(test_timestamp)) {
            return res.status(400).json({ message: 'Invalid test_timestamp' });
        }

        if (
            !isValidNumber(ph_value, PH_RANGE) ||
            !isValidNumber(tds_ppm_value, TDS_RANGE) ||
            !isValidNumber(ec_us_cm_value, EC_RANGE) ||
            !isValidNumber(hardness_mg_l_caco3, HARDNESS_RANGE)
        ) {
            return res.status(400).json({ message: 'Invalid numeric values' });
        }

        // Ensure no existing log for same stage, session and date
        const checkQuery = `
            SELECT 1 FROM water_quality_logs
            WHERE stage_id = $1 AND test_session = $2 AND DATE(test_timestamp) = $3
            LIMIT 1
        `;
        const testDate = new Date(test_timestamp).toISOString().split('T')[0];
        const existing = await db.query(checkQuery, [stage_id, test_session, testDate]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ message: 'Log already exists for this stage, session, and date' });
        }

        const query = `
            INSERT INTO water_quality_logs
                        (stage_id, test_session, test_timestamp,
                        ph_value, tds_ppm_value, ec_us_cm_value, hardness_mg_l_caco3,
                        recorded_by_user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        const { rows } = await db.query(query, [
            stage_id,
            test_session,
            test_timestamp,
            ph_value,
            tds_ppm_value,
            ec_us_cm_value,
            hardness_mg_l_caco3,
            recorded_by_user_id
        ]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Retrieve all configured water test stages
exports.getTestStages = async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT stage_id, stage_name FROM water_test_stages ORDER BY stage_id'
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Retrieve water test logs over a date range (defaults to last 7 days)
// Dates must be in 'YYYY-MM-DD' format and interpreted as UTC.
exports.getRecentWaterLogs = async (req, res) => {
    let { start_date, end_date } = req.query;

    try {
        const endDateStr = end_date || new Date().toISOString().split('T')[0];
        const endDateObj = parseUTCDate(endDateStr);

        let startDateObj;
        if (start_date) {
            startDateObj = parseUTCDate(start_date);
        } else {
            startDateObj = new Date(endDateObj);
            startDateObj.setUTCDate(endDateObj.getUTCDate() - 6);
        }

        const end = endDateObj.toISOString().split('T')[0];
        const start = startDateObj.toISOString().split('T')[0];

        const query = `
            SELECT l.log_id, l.stage_id, s.stage_name, l.test_session,
                   l.ph_value, l.tds_ppm_value, l.ec_us_cm_value,
                   l.hardness_mg_l_caco3,
                   l.test_timestamp, u.username AS recorded_by
            FROM water_quality_logs l
            JOIN water_test_stages s ON l.stage_id = s.stage_id
            LEFT JOIN users u ON l.recorded_by_user_id = u.id
            WHERE DATE(l.test_timestamp) BETWEEN $1 AND $2
            ORDER BY l.test_timestamp ASC
        `;

        const { rows } = await db.query(query, [start, end]);
        res.status(200).json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Delete logs by date (for cleanup/admin purposes)
exports.deleteWaterLogsByDate = async (req, res) => {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: 'Valid date (YYYY-MM-DD) is required.' });
    }

    try {
        const query = `
            DELETE FROM water_quality_logs
            WHERE DATE(test_timestamp) = $1
            RETURNING log_id
        `;
        const { rows } = await db.query(query, [date]);
        
        res.status(200).json({ 
            message: 'Water logs deleted successfully',
            deletedCount: rows.length,
            deletedLogIds: rows.map(row => row.log_id)
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
