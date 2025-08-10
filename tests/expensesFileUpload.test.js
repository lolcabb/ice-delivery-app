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

  test('PUT /api/expenses/:id updates expense with file', async () => {
    const oldRow = {
      expense_date: new Date('2024-02-01T00:00:00Z'),
      paid_date: null,
      is_petty_cash_expense: false,
      related_document_url: 'old'
    };
    const updatedRow = {
      expense_id: 3,
      is_petty_cash_expense: false,
      expense_date: '2024-02-01',
      paid_date: '2024-02-01',
      related_document_url: 'http://fake.url/new.jpg'
    };
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [oldRow] })
      .mockResolvedValueOnce({ rows: [updatedRow] })
      .mockResolvedValueOnce({});

    jest
      .spyOn(expensesRoutes, 'uploadExpenseReceiptToGCS')
      .mockResolvedValue('http://fake.url/new.jpg');

    const res = await request(app)
      .put('/api/expenses/3')
      .field('expense_date', '2024-02-01')
      .field('category_id', '1')
      .field('description', 'Upd')
      .field('amount', '15')
      .field('payment_method', 'cash')
      .field('reference_details', 'ref')
      .field('is_petty_cash_expense', 'false')
      .attach('receipt_file', Buffer.from('data'), 'r.jpg');

    expect(res.statusCode).toBe(200);
    expect(expensesRoutes.uploadExpenseReceiptToGCS).toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('UPDATE expenses'),
      [
        '2024-02-01',
        '2024-02-01',
        1,
        'Upd',
        15,
        'cash',
        'ref',
        false,
        'http://fake.url/new.jpg',
        3
      ]
    );
    expect(res.body.related_document_url).toBe('http://fake.url/new.jpg');
  });

  test('DELETE /api/expenses/:id removes petty cash expense', async () => {
    const selectRow = {
      expense_date: new Date('2024-02-02T00:00:00Z'),
      paid_date: null,
      is_petty_cash_expense: true
    };
    const deletedRow = { expense_id: 4 };
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [selectRow] })
      .mockResolvedValueOnce({ rows: [deletedRow] })
      .mockResolvedValueOnce({ rows: [{ total_expenses: 0 }] })
      .mockResolvedValueOnce({ rows: [{}] })
      .mockResolvedValueOnce({});

    const res = await request(app).delete('/api/expenses/4');

    expect(res.statusCode).toBe(200);
    expect(mockClient.query).toHaveBeenNthCalledWith(
      3,
      'DELETE FROM expenses WHERE expense_id = $1 RETURNING *',
      [4]
    );
    expect(res.body.message).toBe('Expense deleted successfully');
  });

  test('POST /api/expenses/petty-cash/:date/reconcile recalculates totals', async () => {
    const finalLog = { log_id: 5, log_date: '2024-02-03' };
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ log_id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ total_expenses: 10 }] })
      .mockResolvedValueOnce({ rows: [{}] })
      .mockResolvedValueOnce({});
    db.query.mockResolvedValueOnce({ rows: [finalLog] });

    const res = await request(app).post(
      '/api/expenses/petty-cash/2024-02-03/reconcile'
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: 'Petty cash log reconciled successfully',
      log: finalLog
    });
  });
});