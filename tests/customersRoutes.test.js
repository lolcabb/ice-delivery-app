const request = require('supertest');
const express = require('express');
jest.mock('../config/index.js', () => ({ GCS_BUCKET_NAME: 'test' }));

jest.mock('../controllers/customerController', () => {
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

const customersRoutes = require('../routes/customers');
const customerController = require('../controllers/customerController');

describe('customer routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/customers', customersRoutes);
    jest.clearAllMocks();
  });

  test('GET /api/customers calls controller', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.statusCode).toBe(200);
    expect(customerController.listCustomers).toHaveBeenCalled();
  });

  test('POST /api/customers uses createCustomer', async () => {
    const res = await request(app).post('/api/customers');
    expect(res.statusCode).toBe(200);
    expect(customerController.createCustomer).toHaveBeenCalled();
  });


  test('GET /api/customers/1 uses getCustomer', async () => {
    const res = await request(app).get('/api/customers/1');
    expect(res.statusCode).toBe(200);
    expect(customerController.getCustomer).toHaveBeenCalled();
  });
});
