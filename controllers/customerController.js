const { query, getClient } = require('../db/postgres');
const { Storage } = require('@google-cloud/storage');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { getConfig } = require('../config/index.js');
const { GCS_BUCKET_NAME } = getConfig();

const gcs = new Storage();
const bucket = gcs.bucket(GCS_BUCKET_NAME);

const uploadToGCS = file => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const fileName = `customers/sales/slip-${Date.now()}-${uuidv4()}.jpeg`;
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({ resumable: false, contentType: 'image/jpeg' });
    blobStream.on('error', err => reject(err));
    blobStream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(publicUrl);
    });
    sharp(file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
      .then(buf => blobStream.end(buf))
      .catch(reject);
  });
};

module.exports = {
  async searchCustomers(req, res, next) {
    const { search, limit = 10, exclude_route_id } = req.query;
    if (!search) return res.status(400).json({ error: 'search is required' });
    try {
      let sql = `SELECT customer_id, customer_name, phone, address FROM customers
                 WHERE (LOWER(customer_name) LIKE $1 OR phone ILIKE $1)`;
      const params = [`%${search.toLowerCase()}%`];
      if (exclude_route_id) {
        sql += ` AND customer_id NOT IN (SELECT customer_id FROM customer_route_assignments
                   WHERE route_id = $2 AND is_active = true)`;
        params.push(parseInt(exclude_route_id));
      }
      sql += ` ORDER BY customer_name ASC LIMIT ${parseInt(limit)}`;
      const { rows } = await query(sql, params);
      res.json(rows);
    } catch (err) { next(err); }
  },

  async getRouteAnalytics(req, res, next) {
    const routeId = parseInt(req.params.route_id);
    if (isNaN(routeId)) return res.status(400).json({ error: 'Invalid route ID.' });
    try {
      const { rows } = await query(
        'SELECT COUNT(*) AS customer_count FROM customers WHERE route_id = $1',
        [routeId]
      );
      res.json({ route_id: routeId, customer_count: parseInt(rows[0].customer_count) });
    } catch (err) { next(err); }
  },

  async getDeliveryRoutes(req, res, next) {
    try {
      const { rows } = await query('SELECT * FROM delivery_routes ORDER BY route_name');
      res.json(rows);
    } catch (err) { next(err); }
  },

  async createDeliveryRoute(req, res, next) {
    const { route_name, is_active = true } = req.body;
    if (!route_name) return res.status(400).json({ error: 'route_name is required' });
    try {
      const { rows } = await query(
        'INSERT INTO delivery_routes (route_name, is_active) VALUES ($1, $2) RETURNING *',
        [route_name, is_active]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  },

  async updateDeliveryRoute(req, res, next) {
    const id = parseInt(req.params.id);
    const { route_name, is_active } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid route ID.' });
    try {
      const { rows } = await query(
        'UPDATE delivery_routes SET route_name = $1, is_active = $2, updated_at = NOW() WHERE route_id = $3 RETURNING *',
        [route_name, is_active, id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Route not found.' });
      res.json(rows[0]);
    } catch (err) { next(err); }
  },

  async deleteDeliveryRoute(req, res, next) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid route ID.' });
    try {
      const { rows } = await query('DELETE FROM delivery_routes WHERE route_id = $1 RETURNING route_id', [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Route not found.' });
      res.json({ message: 'Route deleted', route_id: rows[0].route_id });
    } catch (err) { next(err); }
  },

  async getCreditSales(req, res, next) {
    const customerId = parseInt(req.params.customerId);
    if (isNaN(customerId)) return res.status(400).json({ error: 'Invalid customer ID.' });
    try {
      const { rows } = await query(
        `SELECT * FROM driver_sales WHERE customer_id = $1 AND payment_type = 'Credit' AND cleared_by_payment_id IS NULL`,
        [customerId]
      );
      res.json(rows);
    } catch (err) { next(err); }
  },

  async createCreditPayment(req, res, next) {
    const customerId = parseInt(req.params.customerId);
    const { payment_date, amount_paid, payment_method, notes, cleared_sale_ids } = req.body;
    const created_by_user_id = req.user.id;
    if (isNaN(customerId)) return res.status(400).json({ error: 'Invalid customer ID.' });
    if (!payment_date || !amount_paid || !payment_method || !cleared_sale_ids) return res.status(400).json({ error: 'Missing required payment details.' });
    let clearedSaleIds;
    try {
      clearedSaleIds = JSON.parse(cleared_sale_ids);
      if (!Array.isArray(clearedSaleIds) || clearedSaleIds.length === 0) return res.status(400).json({ error: 'cleared_sale_ids must be a non-empty array.' });
    } catch (e) { return res.status(400).json({ error: 'Invalid format for cleared_sale_ids.' }); }

    const client = await getClient();
    try {
      const slip_image_url = await uploadToGCS(req.file);
      await client.query('BEGIN');
      const paymentResult = await client.query(
        `INSERT INTO customer_credit_payments (customer_id, payment_date, amount_paid, payment_method, notes, slip_image_url, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING payment_id`,
        [customerId, payment_date, parseFloat(amount_paid), payment_method, notes, slip_image_url, created_by_user_id]
      );
      const newPaymentId = paymentResult.rows[0].payment_id;
      const updateSalesQuery = `UPDATE driver_sales SET cleared_by_payment_id = $1 WHERE sale_id = ANY($2::int[]) AND customer_id = $3`;
      await client.query(updateSalesQuery, [newPaymentId, clearedSaleIds, customerId]);
      const linkPromises = clearedSaleIds.map(id => client.query(`INSERT INTO payment_cleared_sales (payment_id, driver_sale_id) VALUES ($1, $2)`, [newPaymentId, id]));
      await Promise.all(linkPromises);
      await client.query('COMMIT');
      res.status(201).json({ message: 'Payment created successfully', payment_id: newPaymentId });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally { client.release(); }
  },

  async getCreditPayments(req, res, next) {
    const customerId = parseInt(req.params.customerId);
    const { start_date, end_date } = req.query;
    if (isNaN(customerId)) return res.status(400).json({ error: 'Invalid customer ID.' });
    try {
      let sql = 'SELECT * FROM customer_credit_payments WHERE customer_id = $1';
      const params = [customerId];
      if (start_date) { params.push(start_date); sql += ` AND payment_date >= $${params.length}`; }
      if (end_date) { params.push(end_date); sql += ` AND payment_date <= $${params.length}`; }
      sql += ' ORDER BY payment_date DESC';
      const { rows } = await query(sql, params);
      res.json(rows);
    } catch (err) { next(err); }
  },

  async voidCreditPayment(req, res, next) {
    const paymentId = parseInt(req.params.paymentId);
    const { void_reason } = req.body;
    const userId = req.user.id;
    if (isNaN(paymentId) || !void_reason) return res.status(400).json({ error: 'Invalid parameters.' });
    try {
      const { rows } = await query(
        'UPDATE customer_credit_payments SET voided_at = NOW(), void_reason = $1, voided_by_user_id = $2 WHERE payment_id = $3 RETURNING *',
        [void_reason, userId, paymentId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Payment not found.' });
      res.json(rows[0]);
    } catch (err) { next(err); }
  },

  async editCreditPayment(req, res, next) {
    const paymentId = parseInt(req.params.paymentId);
    const { payment_date, amount_paid, payment_method, notes } = req.body;
    if (isNaN(paymentId)) return res.status(400).json({ error: 'Invalid payment ID.' });
    try {
      const { rows } = await query(
        `UPDATE customer_credit_payments SET payment_date=$1, amount_paid=$2, payment_method=$3, notes=$4, updated_at = NOW() WHERE payment_id=$5 RETURNING *`,
        [payment_date, amount_paid ? parseFloat(amount_paid) : null, payment_method, notes, paymentId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Payment not found.' });
      res.json(rows[0]);
    } catch (err) { next(err); }
  },

  async createCustomer(req, res, next) {
    const { customer_name, phone, address, contact_person, customer_type, route_id, notes, is_active = true } = req.body;
    const user_id_created_by = req.user.id;
    if (!customer_name) return res.status(400).json({ error: 'Customer name is required.' });
    try {
      const result = await query(
        `INSERT INTO customers (customer_name, phone, address, contact_person, customer_type, route_id, notes, is_active, user_id_created_by, user_id_last_updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING *`,
        [customer_name, phone || null, address || null, contact_person || null, customer_type || null, route_id ? parseInt(route_id) : null, notes || null, is_active, user_id_created_by]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23503' && err.constraint === 'customers_route_id_fkey') return next(err);
      next(err);
    }
  },

  async listCustomers(req, res, next) {
    const { page = 1, limit = 20, search, is_active } = req.query;
    try {
      const offset = (parseInt(page) - 1) * parseInt(limit);
      let baseSql = 'FROM customers';
      const where = [];
      const params = [];
      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        where.push(`(LOWER(customer_name) LIKE $${params.length} OR phone ILIKE $${params.length})`);
      }
      if (is_active !== undefined) {
        params.push(is_active === 'true');
        where.push(`is_active = $${params.length}`);
      }
      const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
      const dataSql = `SELECT * ${baseSql}${whereClause} ORDER BY customer_name ASC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
      const countSql = `SELECT COUNT(*) ${baseSql}${whereClause}`;
      const dataRes = await query(dataSql, params);
      const countRes = await query(countSql, params);
      res.json({
        data: dataRes.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalItems: parseInt(countRes.rows[0].count)
        }
      });
    } catch (err) { next(err); }
  },

  async getCustomer(req, res, next) {
    const customerId = parseInt(req.params.id);
    if (isNaN(customerId)) return res.status(400).json({ error: 'Invalid customer ID.' });
    try {
      const result = await query(`SELECT c.*, dr.route_name FROM customers c LEFT JOIN delivery_routes dr ON c.route_id = dr.route_id WHERE c.customer_id = $1`, [customerId]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found.' });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  },

  async updateCustomer(req, res, next) {
    const customerId = parseInt(req.params.id);
    const { customer_name, phone, address, contact_person, customer_type, route_id, notes, is_active } = req.body;
    const user_id_last_updated_by = req.user.id;
    if (isNaN(customerId)) return res.status(400).json({ error: 'Invalid customer ID.' });
    if (!customer_name) return res.status(400).json({ error: 'Customer name is required.' });
    try {
      const result = await query(
        `UPDATE customers SET customer_name = $1, phone = $2, address = $3, contact_person = $4, customer_type = $5, route_id = $6, notes = $7, is_active = $8, user_id_last_updated_by = $9, updated_at = NOW() WHERE customer_id = $10 RETURNING *`,
        [customer_name, phone || null, address || null, contact_person || null, customer_type || null, route_id ? parseInt(route_id) : null, notes || null, is_active === undefined ? true : is_active, user_id_last_updated_by, customerId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found.' });
      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === '23503' && err.constraint === 'customers_route_id_fkey') return next(err);
      next(err);
    }
  },

  async deleteCustomer(req, res, next) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid customer ID.' });
    try {
      const { rows } = await query(
        'UPDATE customers SET is_active = false, updated_at = NOW() WHERE customer_id = $1 RETURNING customer_id',
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Customer not found.' });
      res.json({ message: 'Customer deleted' });
    } catch (err) { next(err); }
  }
};
