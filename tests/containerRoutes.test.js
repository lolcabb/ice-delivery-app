const request = require('supertest');
const express = require('express');
jest.mock('../config/index.js', () => ({ SOME_CONFIG: 'x' }));

jest.mock('../controllers/containerController', () => {
  const controller = {};
  return new Proxy(controller, {
    get: (target, prop) => {
      if (!target[prop]) target[prop] = jest.fn((req, res) => res.status(200).end());
      return target[prop];
    }
  });
});

jest.mock('../middleware/auth', () => {
  let role = 'admin';
  return {
    __setRole: r => { role = r; },
    authMiddleware: (req, res, next) => { req.user = { id: 1, role }; next(); },
    requireRole: roles => (req, res, next) => {
      if (!roles.includes(role)) return res.status(403).json({ message: 'Forbidden' });
      next();
    }
  };
});

const containerRoutes = require('../routes/containerRoutes');
const containerController = require('../controllers/containerController');
const { __setRole } = require('../middleware/auth');

describe('container routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/containers', containerRoutes);
    jest.clearAllMocks();
    __setRole('admin');
  });

  test('GET /api/containers/sizes uses controller', async () => {
    const res = await request(app).get('/api/containers/sizes');
    expect(res.statusCode).toBe(200);
    expect(containerController.getContainerSizes).toHaveBeenCalled();
  });

  test('POST /api/containers/sizes requires role', async () => {
    __setRole('driver');
    const res = await request(app).post('/api/containers/sizes');
    expect(res.statusCode).toBe(403);
    expect(containerController.createContainerSize).not.toHaveBeenCalled();
  });
});
