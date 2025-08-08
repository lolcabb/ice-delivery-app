const request = require('supertest');
const express = require('express');

jest.mock('../controllers/waterController', () => {
  const controller = {};
  return new Proxy(controller, {
    get: (target, prop) => {
      if (!target[prop]) target[prop] = jest.fn((req, res) => res.status(200).end());
      return target[prop];
    }
  });
});

jest.mock('../middleware/auth', () => ({
  authMiddleware: (req, res, next) => { req.user = { id: 1 }; next(); },
  requireRole: () => (req, res, next) => next()
}));

const waterRoutes = require('../routes/water');
const waterController = require('../controllers/waterController');

describe('water routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/water', waterRoutes);
    jest.clearAllMocks();
  });

  test('GET /logs returns logs', async () => {
    waterController.getAllWaterLogs.mockImplementation((req, res) => res.status(200).json([]));
    const res = await request(app).get('/api/water/logs');
    expect(res.statusCode).toBe(200);
    expect(waterController.getAllWaterLogs).toHaveBeenCalled();
  });

  test('POST /logs adds log', async () => {
    waterController.addWaterLog.mockImplementation((req, res) => res.status(201).json({ id: 1 }));
    const res = await request(app).post('/api/water/logs').send({ hardness_mg_l_caco3: 120 });
    expect(res.statusCode).toBe(201);
    expect(waterController.addWaterLog).toHaveBeenCalled();
    expect(waterController.addWaterLog.mock.calls[0][0].body.hardness_mg_l_caco3).toBe(120);
  });

  test('GET /logs/recent calls controller', async () => {
    waterController.getRecentWaterLogs.mockImplementation((req, res) => res.status(200).json([]));
    const res = await request(app).get('/api/water/logs/recent');
    expect(res.statusCode).toBe(200);
    expect(waterController.getRecentWaterLogs).toHaveBeenCalled();
  });

  test('GET /stages calls controller', async () => {
    waterController.getTestStages.mockImplementation((req, res) => res.status(200).json([]));
    const res = await request(app).get('/api/water/stages');
    expect(res.statusCode).toBe(200);
    expect(waterController.getTestStages).toHaveBeenCalled();
  });
});
