import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import ExpenseList from '../expenses/ExpenseList.jsx';

// Stub PaymentMethodBadge to avoid unrelated complexity
jest.mock('../components/PaymentMethodBadge.jsx', () => () => <div data-testid="payment-method-badge" />);

const sampleExpense = {
  expense_id: 1,
  expense_date: '2023-01-01',
  paid_date: '2023-01-02',
  category_name: 'Meals',
  description: 'Lunch',
  reference_details: 'Ref',
  amount: 50,
  is_petty_cash_expense: false,
  payment_method: 'cash',
  related_document_url: 'https://example.com/receipt.jpg'
};

test('shows receipt button and opens modal on click', async () => {
  render(
    <ExpenseList
      expenses={[sampleExpense]}
      onEdit={jest.fn()}
      onDelete={jest.fn()}
      isLoading={false}
      pagination={{ page: 1, totalPages: 1, totalItems: 1 }}
      onPageChange={jest.fn()}
    />
  );

  const button = screen.getByTitle('ดูใบเสร็จ');
  expect(button).toBeInTheDocument();

  fireEvent.click(button);

  const img = await screen.findByAltText('ใบเสร็จ');
  expect(img).toHaveAttribute('src', sampleExpense.related_document_url);
});

test('displays paid date when available', () => {
  render(
    <ExpenseList
      expenses={[sampleExpense]}
      onEdit={jest.fn()}
      onDelete={jest.fn()}
      isLoading={false}
      pagination={{ page: 1, totalPages: 1, totalItems: 1 }}
      onPageChange={jest.fn()}
    />
  );

  expect(screen.getByText('1 ม.ค. 2566')).toBeInTheDocument();
  expect(screen.getByText('2 ม.ค. 2566')).toBeInTheDocument();
});

test('sorts expenses by paid date then expense date', () => {
  const expenses = [
    {
      expense_id: 1,
      expense_date: '2023-01-01',
      paid_date: '2023-01-10',
      category_name: 'A',
      description: 'Latest paid',
      reference_details: '',
      amount: 10,
      is_petty_cash_expense: false,
      payment_method: 'cash',
      related_document_url: null
    },
    {
      expense_id: 2,
      expense_date: '2023-01-02',
      paid_date: '2023-01-05',
      category_name: 'B',
      description: 'Earlier paid',
      reference_details: '',
      amount: 20,
      is_petty_cash_expense: false,
      payment_method: 'cash',
      related_document_url: null
    },
    {
      expense_id: 3,
      expense_date: '2023-01-03',
      paid_date: null,
      category_name: 'C',
      description: 'No paid date',
      reference_details: '',
      amount: 30,
      is_petty_cash_expense: false,
      payment_method: 'cash',
      related_document_url: null
    }
  ];

  render(
    <ExpenseList
      expenses={expenses}
      onEdit={jest.fn()}
      onDelete={jest.fn()}
      isLoading={false}
      pagination={{ page: 1, totalPages: 1, totalItems: 3 }}
      onPageChange={jest.fn()}
    />
  );

  const rows = screen.getAllByRole('row').slice(1); // skip header
  const descriptions = rows.map((row) =>
    within(row).getByText(/Latest paid|Earlier paid|No paid date/).textContent
  );

  expect(descriptions).toEqual([
    'Latest paid',
    'Earlier paid',
    'No paid date'
  ]);
});
