import { request } from './base.js';

export const addCustomer = (customerData) => request('/customers', 'POST', customerData);

export const getCustomers = (filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return request(`/customers?${query}`);
};

export const getCustomerById = (customerId) => request(`/customers/${customerId}`);

export const updateCustomer = (customerId, data) => request(`/customers/${customerId}`, 'PUT', data);

export const deleteCustomer = (customerId) => request(`/customers/${customerId}`, 'DELETE');

export const getDeliveryRoutes = async () => {
    const { data } = await request('/customers/delivery-routes');
    return data || [];
};
