const { query, getClient } = require('../db/postgres');

module.exports = {
  async getContainerSizes(req, res, next) {
    try {
      const result = await query('SELECT * FROM ice_container_sizes WHERE is_active = TRUE ORDER BY capacity_liters ASC');
      res.json(result.rows);
    } catch (err) { next(err); }
  },

  async createContainerSize(req, res, next) {
    const { size_code, description, capacity_liters } = req.body;
    if (!size_code || capacity_liters === undefined) return res.status(400).json({ error: 'Size code and capacity (liters) are required.' });
    if (isNaN(parseInt(capacity_liters)) || parseInt(capacity_liters) <= 0) return res.status(400).json({ error: 'Capacity must be a positive number.' });
    try {
      const result = await query('INSERT INTO ice_container_sizes (size_code, description, capacity_liters) VALUES ($1, $2, $3) RETURNING *', [size_code, description, parseInt(capacity_liters)]);
      res.status(201).json(result.rows[0]);
    } catch (err) { if (err.code === '23505') return next(err); next(err); }
  },

  updateContainerSize: async (req, res, next) => { res.status(200).end(); },
  deleteContainerSize: async (req, res, next) => { res.status(200).end(); },
  getReturnReasons: async (req, res, next) => { res.status(200).end(); },
  createReturnReason: async (req, res, next) => { res.status(201).end(); },
  updateReturnReason: async (req, res, next) => { res.status(200).end(); },
  deleteReturnReason: async (req, res, next) => { res.status(200).end(); },

  addContainerItem: async (req, res, next) => { res.status(201).end(); },

  async listContainerItems(req, res, next) {
    const { page = 1, limit = 20, serial_number, size_id, container_type, status, customer_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let mainQuery = `
        SELECT
            c.*, cs.size_code, cs.capacity_liters, cs.description AS size_description,
            CASE WHEN c.status = 'With Customer' THEN cust.customer_name ELSE NULL END as current_customer_name_display
        FROM ice_containers c
        LEFT JOIN ice_container_sizes cs ON c.size_id = cs.size_id
        LEFT JOIN customers cust ON c.current_customer_id = cust.customer_id`;
    let countQuery = `
        SELECT COUNT(c.*)
        FROM ice_containers c
        LEFT JOIN ice_container_sizes cs ON c.size_id = cs.size_id
        LEFT JOIN customers cust ON c.current_customer_id = cust.customer_id`;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (serial_number) { conditions.push(`c.serial_number ILIKE $${paramIndex++}`); values.push(`%${serial_number}%`); }
    if (size_id) { conditions.push(`c.size_id = $${paramIndex++}`); values.push(parseInt(size_id)); }
    if (container_type) { conditions.push(`c.container_type = $${paramIndex++}`); values.push(container_type); }
    if (status) { conditions.push(`c.status = $${paramIndex++}`); values.push(status); }
    if (customer_id) { conditions.push(`c.current_customer_id = $${paramIndex++}`); values.push(parseInt(customer_id)); }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      mainQuery += whereClause;
      countQuery += whereClause;
    }

    mainQuery += ` ORDER BY c.serial_number ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const mainQueryValues = [...values, parseInt(limit), parseInt(offset)];

    try {
      const result = await query(mainQuery, mainQueryValues);
      const countResult = await query(countQuery, values);
      const totalItems = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalItems / parseInt(limit));
      res.json({ data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), totalItems, totalPages } });
    } catch (err) { next(err); }
  },

  getContainerById: async (req, res, next) => { res.status(200).end(); },
  updateContainer: async (req, res, next) => { res.status(200).end(); },
  deleteContainer: async (req, res, next) => { res.status(200).end(); },

  async assignContainer(req, res, next) {
    const containerId = parseInt(req.params.containerId);
    const { customer_id, assigned_date, notes, expected_return_date } = req.body;
    const user_id = req.user.id;

    if (isNaN(containerId)) return res.status(400).json({ error: 'Invalid container ID.' });
    if (!customer_id || isNaN(parseInt(customer_id))) return res.status(400).json({ error: 'Valid Customer ID is required for assignment.' });
    if (!assigned_date) return res.status(400).json({ error: 'Assigned date is required.' });
    if (expected_return_date && !/^\d{4}-\d{2}-\d{2}$/.test(expected_return_date)) return res.status(400).json({ error: 'Invalid expected_return_date format. Use YYYY-MM-DD.' });

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const containerResult = await client.query('SELECT status FROM ice_containers WHERE container_id = $1 FOR UPDATE', [containerId]);
      if (containerResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Container not found.' }); }
      if (containerResult.rows[0].status !== 'In Stock') { await client.query('ROLLBACK'); return res.status(400).json({ error: `Container is not available for assignment. Current status: ${containerResult.rows[0].status}` }); }

      const assignmentResult = await client.query(
          `INSERT INTO ice_container_assignments (container_id, customer_id, assigned_date, notes, user_id, expected_return_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [containerId, parseInt(customer_id), assigned_date, notes, user_id, expected_return_date || null]
      );
      const newAssignment = assignmentResult.rows[0];

      await client.query(
          `UPDATE ice_containers SET status = 'With Customer', current_customer_id = $1, current_assignment_id = $2, user_id_last_updated_by = $3, updated_at = NOW() WHERE container_id = $4`,
          [parseInt(customer_id), newAssignment.assignment_id, user_id, containerId]
      );
      await client.query('COMMIT');

      const fullAssignment = await query(
          `SELECT a.*, c.serial_number, cust.customer_name FROM ice_container_assignments a JOIN ice_containers c ON a.container_id = c.container_id JOIN customers cust ON a.customer_id = cust.customer_id WHERE a.assignment_id = $1`,
          [newAssignment.assignment_id]
      );
      res.status(201).json(fullAssignment.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23503' && err.constraint === 'ice_container_assignments_customer_id_fkey') return next(err);
      next(err);
    } finally { client.release(); }
  },

  updateAssignment: async (req, res, next) => { res.status(200).end(); },
  returnContainer: async (req, res, next) => { res.status(200).end(); },
  getAssignmentsForContainer: async (req, res, next) => { res.status(200).end(); },
  listAssignments: async (req, res, next) => { res.status(200).end(); }
};
