const waterController = require('../controllers/waterController');
const db = require('../db/postgres');

jest.mock('../db/postgres', () => ({
  query: jest.fn()
}));

describe('waterController.addWaterLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test('records hardness value for RO stage', async () => {
    const req = {
      body: {
        stage_id: 5,
        test_session: 'Morning',
        test_timestamp: '2024-01-01T08:00:00Z',
        ph_value: 7.0,
        tds_ppm_value: 50,
        ec_us_cm_value: 100,
        hardness_mg_l_caco3: 120
      },
      user: { id: 1 }
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{}] });

    await waterController.addWaterLog(req, res);

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query).toHaveBeenNthCalledWith(1, expect.any(String), [5, 'Morning', '2024-01-01']);
    expect(db.query).toHaveBeenNthCalledWith(2, expect.any(String), [
      5,
      'Morning',
      '2024-01-01T08:00:00Z',
      7.0,
      50,
      100,
      120,
      1
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('returns 409 if log already exists', async () => {
    const req = {
      body: {
        stage_id: 5,
        test_session: 'Morning',
        test_timestamp: '2024-01-01T08:00:00Z',
        ph_value: 7.0,
        tds_ppm_value: 50,
        ec_us_cm_value: 100,
        hardness_mg_l_caco3: 120
      },
      user: { id: 1 }
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    db.query.mockResolvedValueOnce({ rows: [{}] });

    await waterController.addWaterLog(req, res);

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Log already exists for this stage, session, and date' });
  });
});
