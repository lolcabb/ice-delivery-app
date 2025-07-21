const request = require('supertest');
const express = require('express');

jest.mock('../controllers/vehicleController', () => {
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

const vehicleRoutes = require('../routes/vehicles');
const vehicleController = require('../controllers/vehicleController');
const { __setRole } = require('../middleware/auth');

describe('vehicle routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/vehicles', vehicleRoutes);
    jest.clearAllMocks();
  });

  test('GET /api/vehicles uses controller', async () => {
    vehicleController.getAllVehicles.mockImplementation((req, res) => res.status(200).json([{ id: 1 }]));
    const res = await request(app).get('/api/vehicles');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 1 }]);
    expect(vehicleController.getAllVehicles).toHaveBeenCalled();
  });

  test('POST /api/vehicles calls addVehicle with role allowed', async () => {
    __setRole('admin');
    vehicleController.addVehicle.mockImplementation((req, res) => res.status(201).json({ id: 2 }));
    const res = await request(app).post('/api/vehicles');
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ id: 2 });
    expect(vehicleController.addVehicle).toHaveBeenCalled();
  });

  test('POST /api/vehicles forbidden for unauthorized role', async () => {
    __setRole('driver');
    const res = await request(app).post('/api/vehicles');
    expect(res.statusCode).toBe(403);
    expect(vehicleController.addVehicle).not.toHaveBeenCalled();
  });

  test('GET /api/vehicles/:id uses controller', async () => {
    vehicleController.getVehicleById.mockImplementation((req, res) => res.status(200).json({ id: req.params.id }));
    const res = await request(app).get('/api/vehicles/5');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: '5' });
    expect(vehicleController.getVehicleById).toHaveBeenCalled();
  });

  test('PUT /api/vehicles/:id requires role', async () => {
    __setRole('staff');
    vehicleController.updateVehicle.mockImplementation((req, res) => res.status(200).json({ ok: true }));
    const res = await request(app).put('/api/vehicles/1');
    expect(res.statusCode).toBe(200);
    expect(vehicleController.updateVehicle).toHaveBeenCalled();
  });

  test('PUT /api/vehicles/:id forbidden for wrong role', async () => {
    __setRole('guest');
    const res = await request(app).put('/api/vehicles/1');
    expect(res.statusCode).toBe(403);
    expect(vehicleController.updateVehicle).not.toHaveBeenCalled();
  });

  test('DELETE /api/vehicles/:id allowed roles', async () => {
    __setRole('admin');
    vehicleController.deleteVehicle.mockImplementation((req, res) => res.status(200).json({ removed: true }));
    const res = await request(app).delete('/api/vehicles/1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ removed: true });
    expect(vehicleController.deleteVehicle).toHaveBeenCalled();
  });

  test('DELETE /api/vehicles/:id forbidden role', async () => {
    __setRole('staff');
    const res = await request(app).delete('/api/vehicles/1');
    expect(res.statusCode).toBe(403);
    expect(vehicleController.deleteVehicle).not.toHaveBeenCalled();
  });

  test('maintenance routes call controller', async () => {
    vehicleController.getMaintenanceForVehicle.mockImplementation((req, res) => res.status(200).json([]));
    const res1 = await request(app).get('/api/vehicles/1/maintenance');
    expect(res1.statusCode).toBe(200);
    expect(vehicleController.getMaintenanceForVehicle).toHaveBeenCalled();

    __setRole('manager');
    vehicleController.addMaintenance.mockImplementation((req, res) => res.status(201).json({ id: 1 }));
    const res2 = await request(app).post('/api/vehicles/1/maintenance');
    expect(res2.statusCode).toBe(201);
    expect(vehicleController.addMaintenance).toHaveBeenCalled();
  });
});
