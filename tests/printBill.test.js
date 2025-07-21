const request = require('supertest');
const express = require('express');
const path = require('path');

jest.mock('../db/postgres', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

const printBillRoute = require('../routes/printBill');
const db = require('../db/postgres');

describe('print bill route', () => {
  let app;
  let renderMock;

  beforeEach(() => {
    app = express();
    app.set('views', path.join(__dirname, '..', 'views'));
    app.set('view engine', 'ejs');
    renderMock = jest.spyOn(app.response, 'render').mockImplementation(function(view, options) {
      this.send('rendered');
    });
    app.use('/print-bill', printBillRoute);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('GET /print-bill/:id renders bill-preview with data', async () => {
    const orderRow = { id: 1, customerName: 'John' };
    const itemRow = { id: 2, orderId: 1 };
    db.query
      .mockResolvedValueOnce({ rows: [orderRow] })
      .mockResolvedValueOnce({ rows: [itemRow] });

    const res = await request(app).get('/print-bill/1');

    expect(res.statusCode).toBe(200);
    expect(renderMock).toHaveBeenCalledWith('bill-preview', expect.objectContaining({
      order: orderRow,
      orderItems: [itemRow],
      formatDate: expect.any(Function),
      toBahtText: expect.any(Function),
    }));
  });
});
