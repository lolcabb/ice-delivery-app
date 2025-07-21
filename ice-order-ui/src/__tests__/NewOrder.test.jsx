import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../apiService.jsx', () => ({ apiService: { post: jest.fn() } }));

import NewOrder from '../NewOrder.jsx';

beforeEach(() => {
  jest.clearAllMocks();
  window.open = jest.fn();
});

const fillRequiredFields = () => {
  fireEvent.change(screen.getByLabelText(/Customer Name/i), { target: { value: 'John' } });
  fireEvent.change(screen.getByLabelText(/^ราคาของน้ำแข็งหลอด$/), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText(/^จำนวนของน้ำแข็งหลอด$/), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText(/Issuer/), { target: { value: 'admin' } });
};

test('shows validation error when price entered without quantity', async () => {
  render(<NewOrder onOrderCreated={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/Customer Name/i), { target: { value: 'John' } });
  fireEvent.change(screen.getByLabelText(/^ราคาของน้ำแข็งหลอด$/), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText(/Issuer/), { target: { value: 'admin' } });
  fireEvent.click(screen.getByRole('button', { name: /ออกบิล/i }));
  expect(await screen.findByText(/กรุณากรอกทั้งราคาและจำนวน/)).toBeInTheDocument();
});

test('submits order and calls callback', async () => {
  const data = { id: 1, status: 'Created' };
  const { apiService } = require('../apiService.jsx');
  apiService.post.mockResolvedValueOnce(data);
  const onCreated = jest.fn();
  render(<NewOrder onOrderCreated={onCreated} />);
  fillRequiredFields();
  fireEvent.click(screen.getByRole('button', { name: /ออกบิล/i }));
  await waitFor(() => expect(apiService.post).toHaveBeenCalled());
  expect(onCreated).toHaveBeenCalledWith(data);
});
