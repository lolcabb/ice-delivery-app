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

  async updateContainerSize(req, res, next) {
    const id = parseInt(req.params.id);
    const { size_code, description, capacity_liters, is_active } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid size id' });
    const updates = [];
    const values = [];
    let idx = 1;
    if (size_code !== undefined) { updates.push(`size_code = $${idx++}`); values.push(size_code); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (capacity_liters !== undefined) {
      if (isNaN(parseInt(capacity_liters)) || parseInt(capacity_liters) <= 0) return res.status(400).json({ error: 'Capacity must be positive' });
      updates.push(`capacity_liters = $${idx++}`); values.push(parseInt(capacity_liters));
    }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    try {
      const result = await query(`UPDATE ice_container_sizes SET ${updates.join(', ')}, updated_at = NOW() WHERE size_id = $${idx} RETURNING *`, values);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Container size not found' });
      res.json(result.rows[0]);
    } catch (err) { if (err.code === '23505') return next(err); next(err); }
  },

  async deleteContainerSize(req, res, next) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid size id' });
    try {
      const result = await query('DELETE FROM ice_container_sizes WHERE size_id = $1 RETURNING size_id', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Container size not found' });
      res.json({ message: 'Container size deleted' });
    } catch (err) { if (err.code === '23503') return next(err); next(err); }
  },

  async getReturnReasons(req, res, next) {
    try {
      const result = await query('SELECT * FROM ice_container_return_reasons WHERE is_active = TRUE ORDER BY reason_description');
      res.json(result.rows);
    } catch (err) { next(err); }
  },

  async createReturnReason(req, res, next) {
    const { reason_description } = req.body;
    if (!reason_description) return res.status(400).json({ error: 'reason_description is required' });
    try {
      const result = await query('INSERT INTO ice_container_return_reasons (reason_description) VALUES ($1) RETURNING *', [reason_description]);
      res.status(201).json(result.rows[0]);
    } catch (err) { if (err.code === '23505') return next(err); next(err); }
  },

  async updateReturnReason(req, res, next) {
    const id = parseInt(req.params.id);
    const { reason_description, is_active } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const updates = [];
    const values = [];
    let idx = 1;
    if (reason_description !== undefined) { updates.push(`reason_description = $${idx++}`); values.push(reason_description); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    try {
      const result = await query(`UPDATE ice_container_return_reasons SET ${updates.join(', ')}, updated_at = NOW() WHERE return_reason_id = $${idx} RETURNING *`, values);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Return reason not found' });
      res.json(result.rows[0]);
    } catch (err) { if (err.code === '23505') return next(err); next(err); }
  },

  async deleteReturnReason(req, res, next) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    try {
      const result = await query('DELETE FROM ice_container_return_reasons WHERE return_reason_id = $1 RETURNING return_reason_id', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Return reason not found' });
      res.json({ message: 'Return reason deleted' });
    } catch (err) { if (err.code === '23503') return next(err); next(err); }
  },

  async addContainerItem(req, res, next) {
    const { serial_number, size_id, container_type, status = 'In Stock', purchase_date, notes } = req.body;
    const user_id = req.user.id;
    if (!serial_number || !size_id || !container_type) return res.status(400).json({ error: 'serial_number, size_id and container_type are required' });
    if (isNaN(parseInt(size_id))) return res.status(400).json({ error: 'size_id must be a number' });
    try {
      const result = await query(
        `INSERT INTO ice_containers (serial_number, size_id, container_type, status, purchase_date, notes, user_id_created_by, user_id_last_updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
        [serial_number, parseInt(size_id), container_type, status, purchase_date || null, notes || null, user_id]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) { if (err.code === '23505') return next(err); next(err); }
  },

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
        SELECT COUNT(*)
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

  async getContainerById(req, res, next) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid container id' });
    try {
      const result = await query(
        `SELECT c.*, cs.size_code, cs.capacity_liters, cs.description AS size_description,
                cust.customer_name AS current_customer_name
         FROM ice_containers c
         LEFT JOIN ice_container_sizes cs ON c.size_id = cs.size_id
         LEFT JOIN customers cust ON c.current_customer_id = cust.customer_id
         WHERE c.container_id = $1`,
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Container not found' });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  },

  async updateContainer(req, res, next) {
    const id = parseInt(req.params.id);
    const { serial_number, size_id, container_type, status, purchase_date, notes, current_customer_id, current_assignment_id } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid container id' });
    const updates = [];
    const values = [];
    let idx = 1;
    if (serial_number !== undefined) { updates.push(`serial_number = $${idx++}`); values.push(serial_number); }
    if (size_id !== undefined) { if (isNaN(parseInt(size_id))) return res.status(400).json({ error: 'size_id must be numeric' }); updates.push(`size_id = $${idx++}`); values.push(parseInt(size_id)); }
    if (container_type !== undefined) { updates.push(`container_type = $${idx++}`); values.push(container_type); }
    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    if (purchase_date !== undefined) { updates.push(`purchase_date = $${idx++}`); values.push(purchase_date || null); }
    if (notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(notes); }
    if (current_customer_id !== undefined) { updates.push(`current_customer_id = $${idx++}`); values.push(current_customer_id ? parseInt(current_customer_id) : null); }
    if (current_assignment_id !== undefined) { updates.push(`current_assignment_id = $${idx++}`); values.push(current_assignment_id ? parseInt(current_assignment_id) : null); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.user.id);
    values.push(id);
    try {
      const result = await query(`UPDATE ice_containers SET ${updates.join(', ')}, user_id_last_updated_by = $${idx++}, updated_at = NOW() WHERE container_id = $${idx} RETURNING *`, values);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Container not found' });
      res.json(result.rows[0]);
    } catch (err) { if (err.code === '23505') return next(err); next(err); }
  },

  async deleteContainer(req, res, next) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid container id' });
    try {
      const result = await query(
        `UPDATE ice_containers SET status = 'Retired', updated_at = NOW(), user_id_last_updated_by = $1 WHERE container_id = $2 RETURNING *`,
        [req.user.id, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Container not found' });
      res.json({ message: 'Container retired', container: result.rows[0] });
    } catch (err) { next(err); }
  },

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

  async updateAssignment(req, res, next) {
    const id = parseInt(req.params.assignmentId);
    const { assigned_date, expected_return_date, notes } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid assignment id' });
    const updates = [];
    const values = [];
    let idx = 1;
    if (assigned_date !== undefined) { updates.push(`assigned_date = $${idx++}`); values.push(assigned_date); }
    if (expected_return_date !== undefined) { updates.push(`expected_return_date = $${idx++}`); values.push(expected_return_date || null); }
    if (notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(notes); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    try {
      const result = await query(`UPDATE ice_container_assignments SET ${updates.join(', ')}, updated_at = NOW() WHERE assignment_id = $${idx} RETURNING *`, values);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  },

  async returnContainer(req, res, next) {
    const id = parseInt(req.params.assignmentId);
    const { returned_date, return_reason_id, custom_return_reason, notes, new_container_status } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid assignment id' });
    if (!returned_date) return res.status(400).json({ error: 'returned_date is required' });
    if (!new_container_status) return res.status(400).json({ error: 'new_container_status is required' });
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const assignRes = await client.query('SELECT container_id FROM ice_container_assignments WHERE assignment_id = $1 FOR UPDATE', [id]);
      if (assignRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Assignment not found' }); }
      const containerId = assignRes.rows[0].container_id;
      await client.query(
        `UPDATE ice_container_assignments SET returned_date = $1, return_reason_id = $2, custom_return_reason = $3, return_notes = $4, updated_at = NOW() WHERE assignment_id = $5`,
        [returned_date, return_reason_id || null, custom_return_reason || null, notes || null, id]
      );
      await client.query(
        `UPDATE ice_containers SET status = $1, current_customer_id = NULL, current_assignment_id = NULL, user_id_last_updated_by = $2, updated_at = NOW() WHERE container_id = $3`,
        [new_container_status, req.user.id, containerId]
      );
      await client.query('COMMIT');
      const { rows } = await query(
        `SELECT a.*, c.serial_number, cust.customer_name FROM ice_container_assignments a
         JOIN ice_containers c ON a.container_id = c.container_id
         JOIN customers cust ON a.customer_id = cust.customer_id
         WHERE a.assignment_id = $1`,
        [id]
      );
      res.json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally { client.release(); }
  },

  async getAssignmentsForContainer(req, res, next) {
    const containerId = parseInt(req.params.containerId);
    const { page = 1, limit = 20 } = req.query;
    if (isNaN(containerId)) return res.status(400).json({ error: 'Invalid container id' });
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
      const data = await query(
        `SELECT a.*, cust.customer_name, c.serial_number FROM ice_container_assignments a
         JOIN customers cust ON a.customer_id = cust.customer_id
         JOIN ice_containers c ON a.container_id = c.container_id
         WHERE a.container_id = $1
         ORDER BY a.assigned_date DESC
         LIMIT $2 OFFSET $3`,
        [containerId, parseInt(limit), offset]
      );
      const countRes = await query('SELECT COUNT(*) FROM ice_container_assignments WHERE container_id = $1', [containerId]);
      res.json({ data: data.rows, pagination: { page: parseInt(page), limit: parseInt(limit), totalItems: parseInt(countRes.rows[0].count) } });
    } catch (err) { next(err); }
  },

  async listAssignments(req, res, next) {
    const { page = 1, limit = 20, serial_number, customer_name_search, returned_status, assigned_date_start, assigned_date_end, expected_return_date_start, expected_return_date_end } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let baseQuery = `FROM ice_container_assignments a JOIN ice_containers c ON a.container_id = c.container_id JOIN customers cust ON a.customer_id = cust.customer_id`;
    const conditions = [];
    const values = [];
    let idx = 1;
    if (serial_number) { conditions.push(`c.serial_number ILIKE $${idx++}`); values.push(`%${serial_number}%`); }
    if (customer_name_search) { conditions.push(`cust.customer_name ILIKE $${idx++}`); values.push(`%${customer_name_search}%`); }
    if (returned_status === 'returned') { conditions.push('a.returned_date IS NOT NULL'); }
    if (returned_status === 'not_returned') { conditions.push('a.returned_date IS NULL'); }
    if (assigned_date_start) { conditions.push(`a.assigned_date >= $${idx++}`); values.push(assigned_date_start); }
    if (assigned_date_end) { conditions.push(`a.assigned_date <= $${idx++}`); values.push(assigned_date_end); }
    if (expected_return_date_start) { conditions.push(`a.expected_return_date >= $${idx++}`); values.push(expected_return_date_start); }
    if (expected_return_date_end) { conditions.push(`a.expected_return_date <= $${idx++}`); values.push(expected_return_date_end); }
    const whereClause = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    try {
      const data = await query(
        `SELECT a.*, c.serial_number, cust.customer_name ${baseQuery}${whereClause} ORDER BY a.assigned_date DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, parseInt(limit), offset]
      );
      const countRes = await query(`SELECT COUNT(*) ${baseQuery}${whereClause}`, values);
      res.json({ data: data.rows, pagination: { page: parseInt(page), limit: parseInt(limit), totalItems: parseInt(countRes.rows[0].count) } });
    } catch (err) { next(err); }
  }
};
