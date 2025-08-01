import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

jest.mock('../api/base.js', () => ({ request: jest.fn() }));

jest.mock('../utils/dateUtils', () => ({
  getCurrentLocalDateISO: () => '2024-01-01',
  getCurrentLocalMonthISO: () => '2024-01'
}));

import AdminPanel from '../AdminPanel.jsx';

beforeEach(() => {
  jest.clearAllMocks();
});

test('fetches and displays orders', async () => {
  const order = { id: 1, customerName: 'Alice', createdAt: '2024-01-01T00:00:00Z', paymentType: 'Cash', items: [] };
  const { request } = require('../api/base.js');
  request.mockResolvedValueOnce({ data: [order] });
  render(<AdminPanel />);
  await screen.findByText('Alice');
  expect(request).toHaveBeenCalledWith('/orders?date=2024-01-01');
  expect(screen.getByText('1')).toBeInTheDocument();
});

test('filters orders by search term', async () => {
  const orders = [
    { id: 1, customerName: 'Alice', createdAt: '2024-01-01T00:00:00Z', paymentType: 'Cash', items: [] },
    { id: 2, customerName: 'Bob', createdAt: '2024-01-01T00:00:00Z', paymentType: 'Debit', items: [] }
  ];
  const { request } = require('../api/base.js');
  request.mockResolvedValueOnce({ data: orders });
  render(<AdminPanel />);
  await screen.findByText('Alice');
  const search = screen.getByPlaceholderText(/Search by ID or Name/i);
  fireEvent.change(search, { target: { value: 'Bob' } });
  expect(screen.getByText('Bob')).toBeInTheDocument();
  expect(screen.queryByText('Alice')).not.toBeInTheDocument();
});
