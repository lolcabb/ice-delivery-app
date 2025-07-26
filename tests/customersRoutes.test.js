const request = require('supertest');
const express = require('express');

jest.mock('../db/postgres', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  authMiddleware: (req, res, next) => { req.user = { id: 1 }; next(); },
  requireRole: () => (req, res, next) => next()
}));

jest.mock('sharp', () => () => ({
  resize: () => ({
    jpeg: () => ({
      toBuffer: () => Promise.resolve(Buffer.from(''))
    })
  })
}));

jest.mock('@google-cloud/storage', () => {
  const EventEmitter = require('events');
  const mockCreateWriteStream = jest.fn(() => {
    const emitter = new EventEmitter();
    return {
      on: (event, cb) => emitter.on(event, cb),
      end: jest.fn(() => process.nextTick(() => emitter.emit('finish')))
    };
  });
  const mockFile = jest.fn(() => ({ name: 'filename', createWriteStream: mockCreateWriteStream }));
  const mockBucket = jest.fn(() => ({ name: 'bucket', file: mockFile }));
  return { Storage: jest.fn(() => ({ bucket: mockBucket })) };
});

const customersRoutes = require('../routes/customers');
const db = require('../db/postgres');

describe('customer routes', () => {
  let app;
  let mockClient;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/customers', customersRoutes);
    mockClient = { query: jest.fn(), release: jest.fn() };
    db.getClient.mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/customers creates a customer', async () => {
    const row = { customer_id: 1, customer_name: 'John' };
    db.query.mockResolvedValueOnce({ rows: [row] });

    const res = await request(app)
      .post('/api/customers')
      .send({ name: 'John', customer_name: 'John' });

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(row);
  });

  test('POST /api/customers requires customer_name', async () => {
    const res = await request(app)
      .post('/api/customers')
      .send({});
    expect(res.statusCode).toBe(400);
  });

  test('GET /api/customers/:id returns a customer', async () => {
    const row = { customer_id: 1, customer_name: 'John' };
    db.query.mockResolvedValueOnce({ rows: [row] });

    const res = await request(app).get('/api/customers/1');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(row);
  });

  test('PUT /api/customers/:id updates a customer', async () => {
    const row = { customer_id: 1, customer_name: 'Jane' };
    db.query.mockResolvedValueOnce({ rows: [row] });

    const res = await request(app)
      .put('/api/customers/1')
      .send({ customer_name: 'Jane' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(row);
  });

  test('POST /api/customers/:customerId/credit-payments uploads slip', async () => {
    const paymentRow = { payment_id: 5 };
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [paymentRow] }) // INSERT
      .mockResolvedValueOnce({}) // UPDATE driver_sales
      .mockResolvedValueOnce({}) // link sale 1
      .mockResolvedValueOnce({}); // COMMIT

    const res = await request(app)
      .post('/api/customers/1/credit-payments')
      .send({
        payment_date: '2024-01-01',
        amount_paid: '100',
        payment_method: 'cash',
        cleared_sale_ids: JSON.stringify([10])
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ message: 'Payment created successfully', payment_id: 5 });
  });

  test('POST /api/customers/:customerId/credit-payments requires fields', async () => {
    const res = await request(app)
      .post('/api/customers/1/credit-payments')
      .send({});

    expect(res.statusCode).toBe(400);
  });

  test('GET /api/customers/customers/search returns matches', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ customer_id: 2 }] });
    const res = await request(app).get('/api/customers/customers/search?search=a');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ customer_id: 2 }]);
  });

  test('GET /api/customers/routes/1/analytics returns count', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ customer_count: '3' }] });
    const res = await request(app).get('/api/customers/routes/1/analytics');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ route_id: 1, customer_count: 3 });
  });

  test('GET /api/customers/delivery-routes returns list', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ route_id: 1 }] });
    const res = await request(app).get('/api/customers/delivery-routes');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ route_id: 1 }]);
  });

  test('POST /api/customers/delivery-routes creates route', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ route_id: 1, route_name: 'A' }] });
    const res = await request(app).post('/api/customers/delivery-routes').send({ route_name: 'A' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ route_id: 1, route_name: 'A' });
  });

  test('PUT /api/customers/delivery-routes/1 updates route', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ route_id: 1, route_name: 'B' }] });
    const res = await request(app).put('/api/customers/delivery-routes/1').send({ route_name: 'B', is_active: false });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ route_id: 1, route_name: 'B' });
  });

  test('DELETE /api/customers/delivery-routes/1 removes route', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ route_id: 1 }] });
    const res = await request(app).delete('/api/customers/delivery-routes/1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'Route deleted', route_id: 1 });
  });

  test('GET /api/customers/1/credit-sales returns sales', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ sale_id: 9 }] });
    const res = await request(app).get('/api/customers/1/credit-sales');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ sale_id: 9 }]);
  });

  test('GET /api/customers/1/credit-payments returns payments', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ payment_id: 7 }] });
    const res = await request(app).get('/api/customers/1/credit-payments');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ payment_id: 7 }]);
  });

  test('POST /api/customers/credit-payments/2/void voids payment', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ payment_id: 2 }] });
    const res = await request(app)
      .post('/api/customers/credit-payments/2/void')
      .send({ void_reason: 'err' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ payment_id: 2 });
  });

  test('PUT /api/customers/credit-payments/3 edits payment', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ payment_id: 3, amount_paid: 5 }] });
    const res = await request(app)
      .put('/api/customers/credit-payments/3')
      .send({ amount_paid: 5 });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ payment_id: 3, amount_paid: 5 });
  });

  test('GET /api/customers lists customers', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ customer_id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });
    const res = await request(app).get('/api/customers');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: [{ customer_id: 1 }], pagination: { page: 1, limit: 20, totalItems: 1 } });
  });

  test('DELETE /api/customers/1 deactivates customer', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ customer_id: 1 }] });
    const res = await request(app).delete('/api/customers/1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'Customer deleted' });
  });
});
