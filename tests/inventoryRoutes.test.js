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

const inventoryRoutes = require('../routes/inventory');
const db = require('../db/postgres');

describe('inventory non-dashboard routes', () => {
  let app;
  let mockClient;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/inventory', inventoryRoutes);
    mockClient = { query: jest.fn(), release: jest.fn() };
    db.getClient.mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('GET /item-types returns list', async () => {
    const rows = [{ item_type_id: 1, type_name: 'Box' }];
    db.query.mockResolvedValueOnce({ rows });

    const res = await request(app).get('/api/inventory/item-types');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(rows);
  });

  test('POST /item-types requires type_name', async () => {
    const res = await request(app).post('/api/inventory/item-types').send({});
    expect(res.statusCode).toBe(400);
  });

  test('POST /item-types duplicate returns 409', async () => {
    db.query.mockRejectedValueOnce({ code: '23505' });

    const res = await request(app)
      .post('/api/inventory/item-types')
      .send({ type_name: 'Box', description: 'desc' });

    expect(res.statusCode).toBe(409);
  });

  describe('consumable movements', () => {
    test('POST /consumables/:id/movements uses current date when missing', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-02-01T00:00:00Z'));
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ current_stock_level: 5 }] }) // SELECT
        .mockResolvedValueOnce({}) // UPDATE
        .mockResolvedValueOnce({ rows: [{ movement_id: 10 }] }) // INSERT
        .mockResolvedValueOnce({}); // COMMIT

      const res = await request(app)
        .post('/api/inventory/consumables/1/movements')
        .send({ movement_type: 'in', quantity_changed: 3 });

      expect(res.statusCode).toBe(201);
      expect(mockClient.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('INSERT INTO inventory_consumable_movements'),
        [
          1,
          new Date('2024-02-01T00:00:00.000Z'),
          'in',
          3,
          8,
          undefined,
          1
        ]
      );
    });

    test('POST /consumables/:id/movements fails when stock insufficient', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ current_stock_level: 2 }] }) // SELECT
        .mockResolvedValueOnce({}); // ROLLBACK

      const res = await request(app)
        .post('/api/inventory/consumables/1/movements')
        .send({ movement_type: 'out', quantity_changed: 5 });

      expect(res.statusCode).toBe(400);
      expect(mockClient.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    });

    test('POST /consumables/:id/movements invalid date returns 400', async () => {
      const res = await request(app)
        .post('/api/inventory/consumables/1/movements')
        .send({ movement_type: 'in', quantity_changed: 1, movement_date: 'bad' });

      expect(res.statusCode).toBe(400);
    });
  });
});
