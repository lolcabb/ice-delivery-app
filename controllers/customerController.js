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
  searchCustomers: async (req, res, next) => { res.status(200).end(); },
  getRouteAnalytics: async (req, res, next) => { res.status(200).end(); },
  getDeliveryRoutes: async (req, res, next) => { res.status(200).end(); },
  createDeliveryRoute: async (req, res, next) => { res.status(201).end(); },
  updateDeliveryRoute: async (req, res, next) => { res.status(200).end(); },
  deleteDeliveryRoute: async (req, res, next) => { res.status(200).end(); },
  getCreditSales: async (req, res, next) => { res.status(200).end(); },

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

  getCreditPayments: async (req, res, next) => { res.status(200).end(); },
  voidCreditPayment: async (req, res, next) => { res.status(200).end(); },
  editCreditPayment: async (req, res, next) => { res.status(200).end(); },

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

  listCustomers: async (req, res, next) => { res.status(200).end(); },

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

  deleteCustomer: async (req, res, next) => { res.status(200).end(); }
};
