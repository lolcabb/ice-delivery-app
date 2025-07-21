const request = require('supertest');
const express = require('express');

jest.mock('../controllers/tireController', () => {
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

const tireRoutes = require('../routes/tires');
const tireController = require('../controllers/tireController');
const { __setRole } = require('../middleware/auth');

describe('tire routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/tires', tireRoutes);
    jest.clearAllMocks();
  });

  test('GET /api/tires returns list', async () => {
    tireController.getAllTires.mockImplementation((req, res) => res.status(200).json([]));
    const res = await request(app).get('/api/tires');
    expect(res.statusCode).toBe(200);
    expect(tireController.getAllTires).toHaveBeenCalled();
  });

  test('POST /api/tires allowed roles', async () => {
    __setRole('manager');
    tireController.addTire.mockImplementation((req, res) => res.status(201).json({ id: 1 }));
    const res = await request(app).post('/api/tires');
    expect(res.statusCode).toBe(201);
    expect(tireController.addTire).toHaveBeenCalled();
  });

  test('POST /api/tires forbidden for wrong role', async () => {
    __setRole('driver');
    const res = await request(app).post('/api/tires');
    expect(res.statusCode).toBe(403);
    expect(tireController.addTire).not.toHaveBeenCalled();
  });

  test('GET /api/tires/assignments uses controller', async () => {
    tireController.getAllAssignments.mockImplementation((req, res) => res.status(200).json([]));
    const res = await request(app).get('/api/tires/assignments');
    expect(res.statusCode).toBe(200);
    expect(tireController.getAllAssignments).toHaveBeenCalled();
  });

  test('PUT /api/tires/:id updates tire', async () => {
    __setRole('staff');
    tireController.updateTire.mockImplementation((req, res) => res.status(200).json({ ok: true }));
    const res = await request(app).put('/api/tires/1');
    expect(res.statusCode).toBe(200);
    expect(tireController.updateTire).toHaveBeenCalled();
  });

  test('POST /api/tires/assign calls controller', async () => {
    __setRole('admin');
    tireController.assignTire.mockImplementation((req, res) => res.status(201).json({ status: 'On Vehicle' }));
    const res = await request(app).post('/api/tires/assign');
    expect(res.statusCode).toBe(201);
    expect(tireController.assignTire).toHaveBeenCalled();
  });

  test('PUT /api/tires/unmount/:id calls controller', async () => {
    __setRole('manager');
    tireController.unmountTire.mockImplementation((req, res) => res.status(200).json({ status: 'In Stock' }));
    const res = await request(app).put('/api/tires/unmount/1');
    expect(res.statusCode).toBe(200);
    expect(tireController.unmountTire).toHaveBeenCalled();
  });
});
