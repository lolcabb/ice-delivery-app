import { request } from './base.js';

export const getContainerSizes = () => request('/containers/sizes');
export const getReturnReasons = () => request('/containers/return-reasons');
export const addIceContainer = (data) => request('/containers/items', 'POST', data);

export const getIceContainers = (filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return request(`/containers/items?${query}`);
};

export const getIceContainerById = (id) => request(`/containers/items/${id}`);
export const updateIceContainer = (id, data) => request(`/containers/items/${id}`, 'PUT', data);
export const retireIceContainer = (id) => request(`/containers/items/${id}`, 'DELETE');
export const assignIceContainer = (id, assignment) => request(`/containers/items/${id}/assign`, 'POST', assignment);
export const returnIceContainer = (assignmentId, data) => request(`/containers/assignments/${assignmentId}/return`, 'PUT', data);

export const getContainerAssignmentHistory = (containerId, filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return request(`/containers/items/${containerId}/assignments?${query}`);
};

export const getAllAssignments = (filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return request(`/containers/assignments?${query}`);
};

export const updateAssignmentDetails = (assignmentId, data) => request(`/containers/assignments/${assignmentId}`, 'PUT', data);
