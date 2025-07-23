import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('../api/auth.js', () => ({ login: jest.fn() }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));

import LoginPage from '../LoginPage.jsx';

test('renders login header', () => {
  render(<LoginPage onLoginSuccess={jest.fn()} />);
  expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
});