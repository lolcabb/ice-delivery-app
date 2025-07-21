const request = require('supertest');
const express = require('express');

jest.mock('../db/postgres', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../middleware/auth', () => ({
  authMiddleware: (req, res, next) => { req.user = { id: 1 }; next(); },
  requireRole: () => (req, res, next) => next(),
}));

const logsRoutes = require('../routes/logs');
const db = require('../db/postgres');

describe('logs routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/logs', logsRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/logs filters by all parameters', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await request(app).get('/api/logs?userId=1&orderId=2&action=create');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 1 }]);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toEqual(expect.stringContaining('userid = $1'));
    expect(sql).toEqual(expect.stringContaining('orderid = $2'));
    expect(sql).toEqual(expect.stringContaining('action = $3'));
    expect(params).toEqual([1, 2, 'create']);
  });

  test('GET /api/logs filters by userId only', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await request(app).get('/api/logs?userId=5');

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toEqual(expect.stringContaining('userid = $1'));
    expect(sql).not.toEqual(expect.stringContaining('orderid = $2'));
    expect(params).toEqual([5]);
  });

  test('GET /api/logs filters by userId and action', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await request(app).get('/api/logs?userId=3&action=update');

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toEqual(expect.stringContaining('userid = $1'));
    expect(sql).toEqual(expect.stringContaining('action = $2'));
    expect(params).toEqual([3, 'update']);
  });
});
