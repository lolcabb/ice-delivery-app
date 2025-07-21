const request = require('supertest');
const express = require('express');

jest.mock('../db/postgres', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn()
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn()
}));

const authRoutes = require('../routes/authRoutes');
const db = require('../db/postgres');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

describe('auth routes login', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('successful login returns token and user', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'foo', role: 'admin', password_hash: 'hash' }] });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('signed-token');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'foo', password: 'secret' });

    expect(res.statusCode).toBe(200);
    expect(jwt.sign).toHaveBeenCalled();
    expect(res.body).toEqual({
      token: 'signed-token',
      user: { id: 1, username: 'foo', role: 'admin' }
    });
  });

  test('login fails when user not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'none', password: 'secret' });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid username or password');
  });

  test('login fails with bad password', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'foo', role: 'admin', password_hash: 'hash' }] });
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'foo', password: 'wrong' });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid username or password');
  });
});
