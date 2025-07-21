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

const driverRoutes = require('../routes/drivers');
const db = require('../db/postgres');

describe('driver routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/drivers', driverRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/drivers creates driver', async () => {
    const row = {
      driver_id: 1,
      first_name: 'John',
      last_name: null,
      phone_number: '123',
      license_plate: null,
      is_active: true,
      notes: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      created_by_user_id: 1,
      last_updated_by_user_id: 1
    };
    db.query.mockResolvedValueOnce({ rows: [row] });

    const res = await request(app)
      .post('/api/drivers')
      .send({ name: 'John', phone_number: '123' });

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ...row, name: row.first_name });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO drivers'),
      ['John', '123', null, true, null, 1]
    );
  });

  test('GET /api/drivers returns list', async () => {
    const row = {
      driver_id: 1,
      first_name: 'John',
      last_name: null,
      phone_number: '123',
      license_plate: null,
      is_active: true,
      notes: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      created_by_user_id: 1,
      last_updated_by_user_id: 1
    };
    db.query.mockResolvedValueOnce({ rows: [row] });

    const res = await request(app).get('/api/drivers');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ ...row, name: row.first_name }]);
  });

  test('GET /api/drivers/:id returns driver', async () => {
    const row = {
      driver_id: 1,
      first_name: 'John',
      last_name: null,
      phone_number: '123',
      license_plate: null,
      is_active: true,
      notes: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      created_by_user_id: 1,
      last_updated_by_user_id: 1
    };
    db.query.mockResolvedValueOnce({ rows: [row] });

    const res = await request(app).get('/api/drivers/1');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ...row, name: row.first_name });
  });

  test('PUT /api/drivers/:id updates driver', async () => {
    const row = {
      driver_id: 1,
      first_name: 'Jane',
      last_name: null,
      phone_number: '123',
      license_plate: null,
      is_active: true,
      notes: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
      created_by_user_id: 1,
      last_updated_by_user_id: 1
    };
    db.query.mockResolvedValueOnce({ rows: [row] });

    const res = await request(app)
      .put('/api/drivers/1')
      .send({ name: 'Jane' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ...row, name: row.first_name });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE drivers'), expect.any(Array));
  });

  test('DELETE /api/drivers/:id deactivates driver', async () => {
    const row = { driver_id: 1, first_name: 'John', last_name: null, is_active: false };
    db.query.mockResolvedValueOnce({ rows: [row] });

    const res = await request(app).delete('/api/drivers/1');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: 'Driver deactivated successfully.',
      driver: { ...row, name: row.first_name }
    });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE drivers'), [1, 1]);
  });
});
