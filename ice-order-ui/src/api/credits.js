import { request } from './base.js';

export const getCustomerCreditSales = (customerId) => request(`/customers/${customerId}/credit-sales`);

export const addCustomerCreditPayment = (customerId, paymentData) => request(`/customers/${customerId}/credit-payments`, 'POST', paymentData);

export const getCustomerCreditPayments = (customerId, filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return request(`/customers/${customerId}/credit-payments?${query}`);
};

export const getCustomerOutstandingCredit = (customerId) => request(`/customers/${customerId}/outstanding-credit`);

export const updateCreditPayment = (paymentId, data) => request(`/customers/credit-payments/${paymentId}`, 'PUT', data);

export const voidCreditPayment = (paymentId, reason) => request(`/customers/credit-payments/${paymentId}/void`, 'POST', { void_reason: reason });
