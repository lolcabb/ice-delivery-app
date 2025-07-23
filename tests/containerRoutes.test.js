const request = require('supertest');
const express = require('express');

let currentUserRole = 'admin';

jest.mock('../db/postgres', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

jest.mock('../middleware/auth', () => {
  let role = 'admin';
  return {
    __esModule: true,
    setRole: r => { role = r; },
    authMiddleware: (req, res, next) => { req.user = { id: 1, role }; next(); },
    requireRole: roles => (req, res, next) => {
      if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
      next();
    }
  };
});

const containerRoutes = require('../routes/containerRoutes');
const db = require('../db/postgres');
const { setRole } = require('../middleware/auth');

describe('container routes', () => {
  let app;
  let mockClient;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/containers', containerRoutes);
    mockClient = { query: jest.fn(), release: jest.fn() };
    db.getClient.mockResolvedValue(mockClient);
    currentUserRole = 'admin';
    setRole('admin');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/containers/sizes returns sizes', async () => {
    const rows = [{ size_id: 1, size_code: 'S' }];
    db.query.mockResolvedValueOnce({ rows });
    const res = await request(app).get('/api/containers/sizes');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(rows);
  });

  test('POST /api/containers/sizes creates size', async () => {
    const row = { size_id: 2, size_code: 'M' };
    db.query.mockResolvedValueOnce({ rows: [row] });
    const res = await request(app)
      .post('/api/containers/sizes')
      .send({ size_code: 'M', description: 'Medium', capacity_liters: 20 });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(row);
  });

  test('POST /api/containers/sizes denies unauthorized role', async () => {
    currentUserRole = 'driver';
    setRole('driver');
    const res = await request(app)
      .post('/api/containers/sizes')
      .send({ size_code: 'L', capacity_liters: 30 });
    expect(res.statusCode).toBe(403);
  });

  test('GET /api/containers/items returns containers', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ container_id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });
    const res = await request(app).get('/api/containers/items?page=1&limit=10');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([{ container_id: 1 }]);
    expect(res.body.pagination.totalItems).toBe(1);
  });

  test('POST /api/containers/items/:id/assign creates assignment', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ status: 'In Stock' }] }) // select
      .mockResolvedValueOnce({ rows: [{ assignment_id: 5 }] }) // insert
      .mockResolvedValueOnce({}) // update
      .mockResolvedValueOnce({}); // COMMIT
    db.query.mockResolvedValueOnce({ rows: [{ assignment_id: 5, container_id: 1 }] });

    const res = await request(app)
      .post('/api/containers/items/1/assign')
      .send({ customerId: 1, customer_id: 1, assigned_date: '2024-01-01' });

    expect(res.statusCode).toBe(201);
    expect(res.body.assignment_id).toBe(5);
  });

  test('POST /api/containers/items requires allowed role', async () => {
    currentUserRole = 'driver';
    setRole('driver');
    const res = await request(app)
      .post('/api/containers/items')
      .send({ serial_number: '123', size_id: 1, container_type: 'TypeA' });
    expect(res.statusCode).toBe(403);
  });
});
