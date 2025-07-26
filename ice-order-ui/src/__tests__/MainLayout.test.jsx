import React from 'react';
import { render, waitFor } from '@testing-library/react';
import MainLayout from '../MainLayout.jsx';
import { API_BASE_URL } from '../api/base.js';

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (h) => (h === 'content-type' ? 'application/json' : null) },
    text: jest.fn().mockResolvedValue('[]')
  });
  localStorage.setItem('authToken', 'test-token');
});

afterEach(() => {
  fetch.mockRestore();
  localStorage.clear();
});

test('requests today orders once with auth header on mount', async () => {
  render(<MainLayout />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(
    `${API_BASE_URL}/orders/today`,
    expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' })
    })
  );
});
