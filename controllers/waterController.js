const db = require('../db/postgres');

//Get all water test logs filtered by a specific date
exports.getAllWaterLogs = async (req, res) => {
    const { date } = req.query;

    try {
        const query = `
            SELECT l.log_id, l.stage_id, s.stage_name, l.test_session,
                   l.ph_value, l.tds_ppm_value, l.ec_us_cm_value,
                   l.test_timestamp, u.username AS recorded_by
            FROM water_test_logs l
            JOIN water_test_stages s ON l.stage_id = s.stage_id
            LEFT JOIN users u ON l.recorded_by_user_id = u.id
            WHERE DATE(l.test_timestamp) = $1
            ORDER BY s.stage_id, l.test_session
        `;
        const { rows } = await db.query(query, [date]);
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
        ec_us_cm_value
    } = req.body;

    const recorded_by_user_id = req.user.id;
    try{
        const query =`
            INSERT INTO water_test_logs
                        (stage_id, test_session, test_timestamp, 
                        ph_value, tds_ppm_value, ec_us_cm_value, recorded_by_user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const { rows } = await db.query(query, [
            stage_id,
            test_session,
            test_timestamp,
            ph_value,
            tds_ppm_value,
            ec_us_cm_value,
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
