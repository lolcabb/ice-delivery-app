import { request } from './base.js';

export const login = (credentials) => request('/auth/login', 'POST', credentials);
export const register = (userData) => request('/auth/register', 'POST', userData);