const request = require('supertest');
const express = require('express');

jest.mock('../db/postgres', () => ({
  query: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  authMiddleware: (req, res, next) => { req.user = { id: 1 }; next(); },
  requireRole: () => (req, res, next) => next()
}));

const expensesRoutes = require('../routes/expenses');
const db = require('../db/postgres');

describe('expenses filtering by paid_date', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/expenses', expensesRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/expenses filters by paid_date range', async () => {
    const expenseRow = {
      expense_id: 1,
      expense_date: '2024-01-01',
      paid_date: '2024-01-02',
      category_name: 'Meals',
      description: 'Lunch',
      amount: 10,
      is_petty_cash_expense: false
    };
    db.query
      .mockResolvedValueOnce({ rows: [expenseRow] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app).get(
      '/api/expenses?paidStartDate=2024-01-02&paidEndDate=2024-01-02'
    );

    expect(res.statusCode).toBe(200);
    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('e.paid_date >= $1'),
      ['2024-01-02', '2024-01-02', 20, 0]
    );
    expect(res.body.data).toEqual([expenseRow]);
  });
});

