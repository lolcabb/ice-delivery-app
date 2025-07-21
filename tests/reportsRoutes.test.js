const request = require('supertest');
const express = require('express');

jest.mock('../db/postgres', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  authMiddleware: (req, res, next) => { req.user = { id: 1, role: 'admin' }; next(); },
  requireRole: () => (req, res, next) => next()
}));

const reportRoutes = require('../routes/reports');
const db = require('../db/postgres');

describe('report routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/reports', reportRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET /daily returns parsed numbers', async () => {
    db.query.mockResolvedValueOnce({ rows: [{
      totalOrders: '3',
      totalRevenue: '150.5',
      cashSales: '100.5',
      debitSales: '20',
      creditSales: '30',
      unspecifiedSales: '0'
    }] });

    const res = await request(app).get('/api/reports/daily?date=2024-04-01');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      date: '2024-04-01',
      totalOrders: 3,
      totalRevenue: 150.5,
      cashSales: 100.5,
      debitSales: 20,
      creditSales: 30,
      unspecifiedSales: 0
    });
    expect(db.query).toHaveBeenCalled();
  });

  test('GET /daily with invalid date returns 400', async () => {
    const res = await request(app).get('/api/reports/daily?date=bad');
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Invalid date format/);
  });

  test('GET /daily database error returns 500', async () => {
    db.query.mockRejectedValueOnce(new Error('fail'));
    const res = await request(app).get('/api/reports/daily?date=2024-04-01');
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Failed to fetch daily report');
  });

  test('GET /monthly returns parsed summary and daily data', async () => {
    db.query.mockResolvedValueOnce({ rows: [{
      summary: {
        totalOrders: '5',
        totalRevenue: '200',
        cashSales: '120',
        debitSales: '50',
        creditSales: '30',
        unspecifiedSales: '0'
      },
      dailyData: [
        {
          report_date: '2024-04-01',
          orderCount: '2',
          totalAmount: '80.5',
          cashSales: '40',
          debitSales: '20.5',
          creditSales: '20',
          unspecifiedSales: '0'
        }
      ]
    }] });

    const res = await request(app).get('/api/reports/monthly?month=2024-04');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      month: '2024-04',
      summary: {
        totalOrders: 5,
        totalRevenue: 200,
        cashSales: 120,
        debitSales: 50,
        creditSales: 30,
        unspecifiedSales: 0
      },
      dailyData: [
        {
          date: '2024-04-01',
          orderCount: 2,
          totalAmount: 80.5,
          cashSales: 40,
          debitSales: 20.5,
          creditSales: 20,
          unspecifiedSales: 0
        }
      ]
    });
  });

  test('GET /monthly with invalid month returns 400', async () => {
    const res = await request(app).get('/api/reports/monthly?month=202404');
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Invalid month format/);
  });

  test('GET /monthly database error returns 500', async () => {
    db.query.mockRejectedValueOnce(new Error('fail'));
    const res = await request(app).get('/api/reports/monthly?month=2024-04');
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Failed to fetch monthly report');
  });
});
