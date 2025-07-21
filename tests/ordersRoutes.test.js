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

const ordersRoutes = require('../routes/orders');
const db = require('../db/postgres');

describe('order routes', () => {
  let app;
  let mockClient;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/orders', ordersRoutes);
    mockClient = { query: jest.fn(), release: jest.fn() };
    db.getClient.mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/orders creates an order with items', async () => {
    const orderRow = {
      id: 1,
      customerName: 'John',
      address: 'A',
      phone: '123',
      driverName: 'Bob',
      status: 'Created',
      issuer: 'Alice',
      createdAt: '2024-01-01T00:00:00.000Z',
      statusUpdatedAt: '2024-01-01T00:00:00.000Z',
      paymentType: 'Cash'
    };
    const itemRow = {
      id: 10,
      orderId: 1,
      productType: 'Block',
      quantity: 2,
      pricePerUnit: 3,
      totalAmount: 6
    };

    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // insert order
      .mockResolvedValueOnce({}) // insert item
      .mockResolvedValueOnce({}) // COMMIT
      .mockResolvedValueOnce({ rows: [orderRow] }) // fetch order
      .mockResolvedValueOnce({ rows: [itemRow] }); // fetch items

    const res = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'John',
        address: 'A',
        phone: '123',
        driverName: 'Bob',
        issuer: 'Alice',
        orderItems: [{ productType: 'Block', quantity: 2, pricePerUnit: 3 }],
        paymentType: 'Cash'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ...orderRow, items: [itemRow] });
    expect(mockClient.query).toHaveBeenNthCalledWith(3,
      expect.stringContaining('INSERT INTO order_items'),
      [1, 'Block', 2, 3, 6]
    );
    expect(mockClient.release).toHaveBeenCalled();
  });

  test('POST /api/orders requires order items', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ issuer: 'Alice', orderItems: [] });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/orders requires issuer', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ orderItems: [{ productType: 'B', quantity: 1, pricePerUnit: 1 }] });
    expect(res.statusCode).toBe(400);
  });

  test('GET /api/orders filters by date and driver', async () => {
    const orderRow = { id: 1 };
    const itemRow = { id: 2, orderId: 1 };
    db.query
      .mockResolvedValueOnce({ rows: [orderRow] })
      .mockResolvedValueOnce({ rows: [itemRow] });

    const res = await request(app)
      .get('/api/orders?driverName=Bob&date=2024-01-01');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ ...orderRow, items: [itemRow] }]);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), [
      'Bob',
      '2024-01-01',
      'Asia/Bangkok'
    ]);
  });
});
