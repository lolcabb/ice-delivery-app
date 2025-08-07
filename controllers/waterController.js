const db = require('../db/postgres');

//Get all water test logs filtered by a specific date
exports.getAllWaterLogs = async (req, res) => {
    const { date } = req.query;

    try {
        const query = `
            SELECT l.log_id, l.stage_id, s.stage_name, l.test_session,
                   l.ph_value, l.tds_ppm_value, l.ec_us_cm_value, l.hardness_mg_l_caco3,
                   l.test_timestamp, u.username AS recorded_by
            FROM water_quality_logs l
            JOIN water_test_stages s ON l.stage_id = s.stage_id
            LEFT JOIN users u ON l.recorded_by_user_id = u.id
            WHERE DATE(l.test_timestamp) = $1
            ORDER BY s.stage_id, l.test_session
        `;
        const { rows } = await db.query(query, [date]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'No water test logs found' });
        }
        res.status(200).json(rows);
    } catch (err) {
        console.error(err.message)
        res.status(500).send('Server error');
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
    try{
        const query =`
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
exports.getRecentWaterLogs = async (req, res) => {
    let { start_date, end_date } = req.query;

    try {
        const endDateObj = end_date ? new Date(end_date) : new Date();
        const startDateObj = start_date ? new Date(start_date) : new Date(endDateObj);

        if (!start_date) {
            startDateObj.setDate(endDateObj.getDate() - 6); // inclusive of end date
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