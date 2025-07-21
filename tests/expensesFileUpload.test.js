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

const expensesRoutes = require('../routes/expenses');
const db = require('../db/postgres');

describe('expense file upload', () => {
  let app;
  let mockClient;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/expenses', expensesRoutes);
    mockClient = { query: jest.fn(), release: jest.fn() };
    db.getClient.mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('multipart POST /api/expenses uploads a file', async () => {
    const expenseRow = { expense_id: 1, related_document_url: 'http://fake.url/receipt.jpg', is_petty_cash_expense: false };
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [expenseRow] }) // INSERT
      .mockResolvedValueOnce({}); // COMMIT

    jest.spyOn(expensesRoutes, 'uploadExpenseReceiptToGCS').mockResolvedValue('http://fake.url/receipt.jpg');

    const res = await request(app)
      .post('/api/expenses')
      .field('expense_date', '2024-01-01')
      .field('category_id', '1')
      .field('description', 'Test expense')
      .field('amount', '10')
      .field('payment_method', 'cash')
      .field('reference_details', 'ref')
      .field('is_petty_cash_expense', 'false')
      .attach('receipt_file', Buffer.from('test'), 'receipt.jpg');

    expect(res.statusCode).toBe(201);
    expect(expensesRoutes.uploadExpenseReceiptToGCS).toHaveBeenCalled();
    expect(res.body.related_document_url).toBe('http://fake.url/receipt.jpg');
  });

  test('JSON POST /api/expenses works without file', async () => {
    const expenseRow = { expense_id: 2, related_document_url: 'http://existing.url/doc.pdf', is_petty_cash_expense: false };
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [expenseRow] })
      .mockResolvedValueOnce({});

    jest.spyOn(expensesRoutes, 'uploadExpenseReceiptToGCS').mockResolvedValue(null);

    const res = await request(app)
      .post('/api/expenses')
      .send({
        expense_date: '2024-01-02',
        category_id: '1',
        description: 'No file',
        amount: '20',
        payment_method: 'cash',
        reference_details: 'ref2',
        is_petty_cash_expense: false,
        related_document_url: 'http://existing.url/doc.pdf'
      });

    expect(res.statusCode).toBe(201);
    expect(expensesRoutes.uploadExpenseReceiptToGCS).toHaveBeenCalledWith(undefined);
    expect(res.body.related_document_url).toBe('http://existing.url/doc.pdf');
  });
});