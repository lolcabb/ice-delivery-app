const request = require('supertest');
const express = require('express');

jest.mock('../db/postgres', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { id: 1 };
    next();
  },
  requireRole: () => (req, res, next) => next()
}));

const expenseRoutes = require('../routes/expenses');
const db = require('../db/postgres');

describe('expense routes - petty cash parsing', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/expenses', expenseRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/expenses parses is_petty_cash_expense string', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ expense_id: 1, is_petty_cash_expense: true, expense_date: '2024-01-01' }] })
        .mockResolvedValueOnce({ rows: [{ total_expenses: '0' }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({}),
      release: jest.fn()
    };
    db.getClient.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/expenses')
      .send({
        expense_date: '2024-01-01',
        category_id: 1,
        description: 'Test',
        amount: 50,
        payment_method: 'Bank Transfer',
        reference_details: 'ref',
        is_petty_cash_expense: 'true'
      });

    expect(res.statusCode).toBe(201);
    const insertCall = client.query.mock.calls.find(call => call[0].includes('INSERT INTO expenses'));
    expect(insertCall[1][6]).toBe(true);
  });

  test('PUT /api/expenses/:id parses is_petty_cash_expense string', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ expense_date: new Date('2024-01-01'), is_petty_cash_expense: false, related_document_url: null }] })
        .mockResolvedValueOnce({ rows: [{ expense_id: 1, is_petty_cash_expense: true, expense_date: '2024-01-01' }] })
        .mockResolvedValueOnce({ rows: [{ total_expenses: '0' }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({}),
      release: jest.fn()
    };
    db.getClient.mockResolvedValue(client);

    const res = await request(app)
      .put('/api/expenses/1')
      .send({
        expense_date: '2024-01-01',
        category_id: 1,
        description: 'Test',
        amount: 60,
        payment_method: 'Bank Transfer',
        reference_details: 'ref',
        is_petty_cash_expense: 'true'
      });

    expect(res.statusCode).toBe(200);
    const updateCall = client.query.mock.calls.find(call => call[0].includes('UPDATE expenses'));
    expect(updateCall[1][6]).toBe(true);
  });
});