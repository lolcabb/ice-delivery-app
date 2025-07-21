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

jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('hashedpw'))
}));

const userRoutes = require('../routes/users');
const db = require('../db/postgres');
const bcrypt = require('bcryptjs');

describe('user routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/users returns users', async () => {
    const rows = [{ id: 1, username: 'a', role: 'admin' }];
    db.query.mockResolvedValueOnce({ rows });

    const res = await request(app).get('/api/users');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(rows);
    expect(db.query).toHaveBeenCalledWith('SELECT id, username, role FROM users');
  });

  test('POST /api/users creates user', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });

    const res = await request(app).post('/api/users').send({
      username: 'new',
      password: 'secret',
      role: 'staff'
    });

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ message: 'User created', id: 2 });
    expect(bcrypt.hash).toHaveBeenCalledWith('secret', 12);
    expect(db.query).toHaveBeenCalledWith(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
      ['new', 'hashedpw', 'staff']
    );
  });

  test('PUT /api/users/:id updates user', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 3, username: 'u', role: 'staff', passwordHash: 'old' }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).put('/api/users/3').send({ role: 'manager' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'User updated' });
    expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE users SET'), ['manager', 3]);
  });

  test('DELETE /api/users/:id deletes user', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ role: 'staff' }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).delete('/api/users/4');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'User deleted' });
    expect(db.query).toHaveBeenNthCalledWith(2, 'DELETE FROM users WHERE id = $1', [4]);
  });
});
