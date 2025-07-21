const request = require('supertest');
const express = require('express');

jest.mock('../db/postgres', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn()
}));

const { authMiddleware, requireRole } = require('../middleware/auth');
const db = require('../db/postgres');
const jwt = require('jsonwebtoken');

describe('auth middleware', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.get('/protected', authMiddleware, (req, res) => {
      res.json({ user: req.user });
    });
    app.get('/admin', authMiddleware, requireRole(['admin']), (req, res) => {
      res.json({ success: true });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('valid token attaches user and allows access', async () => {
    jwt.verify.mockReturnValue({ id: 1 });
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'u', role: 'admin' }] });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer token');

    expect(res.statusCode).toBe(200);
    expect(res.body.user).toEqual({ id: 1, username: 'u', role: 'admin' });
  });

  test('missing token returns 401', async () => {
    const res = await request(app).get('/protected');
    expect(res.statusCode).toBe(401);
  });

  test('expired token returns 401', async () => {
    jwt.verify.mockImplementation(() => {
      const err = new Error('expired');
      err.name = 'TokenExpiredError';
      throw err;
    });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer expired');

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/Token expired/i);
  });

  test('requireRole allows user with correct role', async () => {
    jwt.verify.mockReturnValue({ id: 2 });
    db.query.mockResolvedValueOnce({ rows: [{ id: 2, username: 'b', role: 'admin' }] });

    const res = await request(app)
      .get('/admin')
      .set('Authorization', 'Bearer token');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('requireRole denies user with wrong role', async () => {
    jwt.verify.mockReturnValue({ id: 3 });
    db.query.mockResolvedValueOnce({ rows: [{ id: 3, username: 'c', role: 'user' }] });

    const res = await request(app)
      .get('/admin')
      .set('Authorization', 'Bearer token');

    expect(res.statusCode).toBe(403);
  });
});
