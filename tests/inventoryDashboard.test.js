const request = require('supertest');
const express = require('express');

jest.mock('../db/postgres', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next()
}));

const inventoryRoutes = require('../routes/inventory');
const db = require('../db/postgres');

describe('inventory dashboard routes', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/inventory', inventoryRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET /dashboard/consumables/summary returns counts', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({ rows: [{ consumable_name: 'Ice', movement_count: 3 }] });

    const res = await request(app).get('/api/inventory/dashboard/consumables/summary');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      lowStockItemsCount: 2,
      distinctConsumableItems: 5,
      mostActiveConsumable: { consumable_name: 'Ice', movement_count: 3 }
    });
  });

  test('GET /dashboard/consumables/recent-movements returns rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await request(app).get('/api/inventory/dashboard/consumables/recent-movements');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 1 }]);
  });

  test('GET /dashboard/consumables/item-type-movement-trend requires item_type_id', async () => {
    const res = await request(app).get('/api/inventory/dashboard/consumables/item-type-movement-trend');
    expect(res.statusCode).toBe(400);
  });

  test('GET /dashboard/consumables/item-type-movement-trend returns trend', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ date: '2024-01-01', total_in: '1', total_out: '0' }] });
    const res = await request(app).get('/api/inventory/dashboard/consumables/item-type-movement-trend?item_type_id=1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ date: '2024-01-01', total_in: 1, total_out: 0 }]);
  });
});