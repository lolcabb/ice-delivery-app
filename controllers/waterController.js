const db = require('../db/postgres');

const ALLOWED_SESSIONS = ['Morning', 'Afternoon'];

// Get all water test logs filtered by a specific date
// Updated with proper ordering
exports.getAllWaterLogs = async (req, res) => {
    const { date } = req.query;

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
exports.upsertWaterLogs = async (req, res) => {
    const { date, logs } = req.body;
    const recorded_by_user_id = req.user.id;
    
    try {
        // Validate input
        if (!date || !logs || !Array.isArray(logs)) {
            return res.status(400).json({ message: 'Invalid input data' });
        }

        // Start transaction
        await db.query('BEGIN');

        const upsertedLogs = [];

        for (const logData of logs) {
            const { stage_id, test_session, ph_value, tds_ppm_value, ec_us_cm_value, hardness_mg_l_caco3 } = logData;

            // Validate required fields
            if (!stage_id || !test_session) {
                await db.query('ROLLBACK');
                return res.status(400).json({ message: 'Missing required fields: stage_id and test_session' });
            }

            if (!ALLOWED_SESSIONS.includes(test_session)) {
                await db.query('ROLLBACK');
                return res.status(400).json({ message: `Unsupported test session: ${test_session}` });
            }

            // Create timestamp for the session
            const hour = test_session === 'Morning' ? '08:00:00' : '14:00:00';
            const timestamp = new Date(`${date}T${hour}Z`).toISOString();

            // PostgreSQL UPSERT using ON CONFLICT
            const query = `
                INSERT INTO water_quality_logs
                    (stage_id, test_session, test_timestamp, ph_value, tds_ppm_value, ec_us_cm_value, hardness_mg_l_caco3, recorded_by_user_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT (stage_id, test_session, DATE(test_timestamp))
                DO UPDATE SET
                    ph_value = EXCLUDED.ph_value,
                    tds_ppm_value = EXCLUDED.tds_ppm_value,
                    ec_us_cm_value = EXCLUDED.ec_us_cm_value,
                    hardness_mg_l_caco3 = EXCLUDED.hardness_mg_l_caco3,
                    recorded_by_user_id = EXCLUDED.recorded_by_user_id,
                    created_at = NOW()
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
        ph_value,
        tds_ppm_value,
        ec_us_cm_value,
        hardness_mg_l_caco3
    } = req.body;

    const recorded_by_user_id = req.user.id;
    try {
        if (!ALLOWED_SESSIONS.includes(test_session)) {
            return res.status(400).json({ message: `Unsupported test session: ${test_session}` });
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
// Add Hardness
exports.getRecentWaterLogs = async (req, res) => {
    let { start_date, end_date } = req.query;

    try {
        const endDateObj = end_date ? new Date(end_date) : new Date();
        const startDateObj = start_date ? new Date(start_date) : new Date(endDateObj);

        if (!start_date) {
            startDateObj.setDate(endDateObj.getDate() - 6);
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