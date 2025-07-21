import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import ExpenseList from '../expenses/ExpenseList.jsx';

// Stub PaymentMethodBadge to avoid unrelated complexity
jest.mock('../components/PaymentMethodBadge.jsx', () => () => <div data-testid="payment-method-badge" />);

const sampleExpense = {
  expense_id: 1,
  expense_date: '2023-01-01',
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