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
  test('sends POST request with auth header and returns JSON', async () => {
    const responseData = { id: 1 };
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(responseData)
    });
    const formData = new FormData();
    const result = await apiService.addExpenseWithFile(formData);
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/expenses`, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      body: formData
    }));
    expect(result).toEqual(responseData);
  });

  test('throws error on non-200 status', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({ error: 'Bad Request' })
    });
    await expect(apiService.addExpenseWithFile(new FormData())).rejects.toMatchObject({
      message: 'Bad Request',
      status: 400,
      data: { error: 'Bad Request' }
    });
  });
});

describe('updateExpenseWithFile', () => {
  test('sends PUT request with auth header and returns JSON', async () => {
    const responseData = { id: 2 };
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(responseData)
    });
    const formData = new FormData();
    const result = await apiService.updateExpenseWithFile(2, formData);
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/expenses/2`, expect.objectContaining({
      method: 'PUT',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      body: formData
    }));
    expect(result).toEqual(responseData);
  });

  test('throws error on non-200 status', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValue({ error: 'Not Found' })
    });
    await expect(apiService.updateExpenseWithFile(3, new FormData())).rejects.toMatchObject({
      message: 'Not Found',
      status: 404,
      data: { error: 'Not Found' }
    });
  });
});