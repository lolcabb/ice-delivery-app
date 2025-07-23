const request = require('supertest');
const express = require('express');

jest.mock('../controllers/orderController', () => {
  const controller = {};
  return new Proxy(controller, {
    get: (target, prop) => {
      if (!target[prop]) target[prop] = jest.fn((req, res) => res.status(200).end());
      return target[prop];
    }
  });
});

jest.mock('../middleware/auth', () => ({
  authMiddleware: (req, res, next) => { req.user = { id: 1 }; next(); },
  requireRole: () => (req, res, next) => next()
}));

const orderRoutes = require('../routes/orders');
const orderController = require('../controllers/orderController');

describe('orders routes use controller', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/orders', orderRoutes);
    jest.clearAllMocks();
  });

  test('POST /api/orders calls controller', async () => {
    orderController.createOrder.mockImplementation((req, res) => res.status(201).json({ id: 1 }));
    const res = await request(app).post('/api/orders').send({});
    expect(res.statusCode).toBe(201);
    expect(orderController.createOrder).toHaveBeenCalled();
  });

  test('GET /api/orders calls controller', async () => {
    orderController.getOrders.mockImplementation((req, res) => res.status(200).json([]));
    const res = await request(app).get('/api/orders');
    expect(res.statusCode).toBe(200);
    expect(orderController.getOrders).toHaveBeenCalled();
  });
});
