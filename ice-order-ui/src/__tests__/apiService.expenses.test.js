const API_BASE_URL = 'http://test/api';

jest.mock('../api/base.js', () => ({
  API_BASE_URL,
  request: jest.fn()
}));

const { apiService } = require('../apiService.jsx');
const { API_BASE_URL: BASE_URL } = require('../api/base.js');

global.fetch = jest.fn();

beforeEach(() => {
  fetch.mockReset();
  localStorage.clear();
  localStorage.setItem('authToken', 'test-token');
});

describe('addExpenseWithFile', () => {
  test('sends POST request with auth header and forwards paid_date', async () => {
    const responseData = { id: 1 };
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(responseData)
    });
    const payload = { description: 'Test', paid_date: '2024-01-01', receipt_file: new Blob(['x'], { type: 'image/png' }) };
    const result = await apiService.addExpenseWithFile(payload);
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/expenses`, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      body: expect.any(FormData)
    }));
    const body = fetch.mock.calls[0][1].body;
    expect(body.get('paid_date')).toBe('2024-01-01');
    expect(result).toEqual(responseData);
  });

  test('throws error on non-200 status', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({ error: 'Bad Request' })
    });
    await expect(apiService.addExpenseWithFile({})).rejects.toMatchObject({
      message: 'Bad Request',
      status: 400,
      data: { error: 'Bad Request' }
    });
  });
});

describe('updateExpenseWithFile', () => {
  test('sends PUT request with auth header and forwards paid_date', async () => {
    const responseData = { id: 2 };
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(responseData)
    });
    const payload = { description: 'Test2', paid_date: '2024-02-01', receipt_file: new Blob(['y'], { type: 'image/png' }) };
    const result = await apiService.updateExpenseWithFile(2, payload);
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/expenses/2`, expect.objectContaining({
      method: 'PUT',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      body: expect.any(FormData)
    }));
    const body = fetch.mock.calls[0][1].body;
    expect(body.get('paid_date')).toBe('2024-02-01');
    expect(result).toEqual(responseData);
  });

  test('throws error on non-200 status', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValue({ error: 'Not Found' })
    });
    await expect(apiService.updateExpenseWithFile(3, {})).rejects.toMatchObject({
      message: 'Not Found',
      status: 404,
      data: { error: 'Not Found' }
    });
  });
});