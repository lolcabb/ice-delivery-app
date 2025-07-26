const request = require('supertest');
const express = require('express');

jest.mock('../db/postgres', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

jest.mock('../controllers/salesOperationsController', () => {
  const controller = {};
  return new Proxy(controller, {
    get: (target, prop) => {
      if (!target[prop]) target[prop] = jest.fn((req, res) => res.status(200).end());
      return target[prop];
    }
  });
});

jest.mock('../middleware/auth', () => {
  const actual = jest.requireActual('../middleware/auth');
  let role = 'admin';
  return {
    requireRole: actual.requireRole,
    authMiddleware: (req, res, next) => {
      req.user = { id: 1, role };
      next();
    },
    __setRole: newRole => {
      role = newRole;
    }
  };
});

const salesOpsRoutes = require('../routes/salesOperations');
const salesOpsController = require('../controllers/salesOperationsController');
const { __setRole } = require('../middleware/auth');

describe('sales operations routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/sales-ops', salesOpsRoutes);
    jest.clearAllMocks();
  });

  test('POST /sales-entry/batch success', async () => {
    __setRole('admin');
    salesOpsController.batchSalesEntry.mockImplementation((req, res) => res.status(200).json({ ok: true }));

    const res = await request(app).post('/api/sales-ops/sales-entry/batch');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(salesOpsController.batchSalesEntry).toHaveBeenCalled();
  });

  test('POST /sales-entry/batch failure path', async () => {
    __setRole('admin');
    salesOpsController.batchSalesEntry.mockImplementation((req, res) => res.status(500).json({ error: 'fail' }));

    const res = await request(app).post('/api/sales-ops/sales-entry/batch');

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'fail' });
    expect(salesOpsController.batchSalesEntry).toHaveBeenCalled();
  });

  test('POST /sales-entry/batch unauthorized role', async () => {
    __setRole('accountant');

    const res = await request(app).post('/api/sales-ops/sales-entry/batch');

    expect(res.statusCode).toBe(403);
    expect(salesOpsController.batchSalesEntry).not.toHaveBeenCalled();
  });

  test('GET /driver-daily-summaries success', async () => {
    __setRole('staff');
    salesOpsController.getDriverDailySummaries.mockImplementation((req, res) => res.status(200).json([{ id: 1 }]));

    const res = await request(app).get('/api/sales-ops/driver-daily-summaries');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 1 }]);
    expect(salesOpsController.getDriverDailySummaries).toHaveBeenCalled();
  });

  test('GET /driver-daily-summaries failure path', async () => {
    __setRole('staff');
    salesOpsController.getDriverDailySummaries.mockImplementation((req, res) => res.status(500).json({ error: 'oops' }));

    const res = await request(app).get('/api/sales-ops/driver-daily-summaries');

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'oops' });
    expect(salesOpsController.getDriverDailySummaries).toHaveBeenCalled();
  });

  test('GET /driver-daily-summaries unauthorized role', async () => {
    __setRole('guest');

    const res = await request(app).get('/api/sales-ops/driver-daily-summaries');

    expect(res.statusCode).toBe(403);
    expect(salesOpsController.getDriverDailySummaries).not.toHaveBeenCalled();
  });

  test('POST /product-returns success', async () => {
    __setRole('manager');
    salesOpsController.createProductReturns.mockImplementation((req, res) => res.status(201).json({ message: 'saved' }));

    const res = await request(app).post('/api/sales-ops/product-returns');

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ message: 'saved' });
    expect(salesOpsController.createProductReturns).toHaveBeenCalled();
  });

  test('POST /product-returns failure path', async () => {
    __setRole('manager');
    salesOpsController.createProductReturns.mockImplementation((req, res) => res.status(500).json({ error: 'bad' }));

    const res = await request(app).post('/api/sales-ops/product-returns');

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'bad' });
    expect(salesOpsController.createProductReturns).toHaveBeenCalled();
  });

  test('POST /product-returns unauthorized role', async () => {
    __setRole('accountant');

    const res = await request(app).post('/api/sales-ops/product-returns');

    expect(res.statusCode).toBe(403);
    expect(salesOpsController.createProductReturns).not.toHaveBeenCalled();
  });

  test('GET /loading-logs with date query hits controller', async () => {
    __setRole('admin');
    const date = '2024-01-01';

    const res = await request(app).get(`/api/sales-ops/loading-logs?date=${date}`);

    expect(res.statusCode).toBe(200);
    expect(salesOpsController.getLoadingLogs).toHaveBeenCalled();
    const reqPassed = salesOpsController.getLoadingLogs.mock.calls[0][0];
    expect(reqPassed.query.date).toBe(date);
  });

  test('GET /loading-logs unauthorized role', async () => {
    __setRole('guest');

    const res = await request(app).get('/api/sales-ops/loading-logs?date=2024-01-01');

    expect(res.statusCode).toBe(403);
    expect(salesOpsController.getLoadingLogs).not.toHaveBeenCalled();
  });
});
