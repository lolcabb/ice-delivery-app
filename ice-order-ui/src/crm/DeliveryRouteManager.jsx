// ice-delivery-app/ice-order-ui/src/crm/DeliveryRouteManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { getDeliveryRoutes } from '../api/customers.js';
import { request } from '../api/base.js';
import DeliveryRouteList from './DeliveryRouteList';
import DeliveryRouteForm from './DeliveryRouteForm';

// A simple + icon for the button
const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

export default function DeliveryRouteManager() {
    const [routes, setRoutes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRoute, setEditingRoute] = useState(null);

    // Fetch all delivery routes from the backend
    const fetchRoutes = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getDeliveryRoutes();
            setRoutes(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.data?.error || err.message || 'Could not load delivery routes.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRoutes();
    }, [fetchRoutes]);

    // Handlers for opening and closing the Add/Edit modal
    const handleOpenModal = useCallback((route = null) => {
        setEditingRoute(route);
        setIsModalOpen(true);
        setError(null);
        setSuccessMessage('');
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingRoute(null);
    }, []);

    // Handler to save a new or edited route
    const handleSaveRoute = useCallback(async (routeData) => {
        try {
            if (editingRoute && editingRoute.route_id) {
                // This is an update
                await request(`/customers/delivery-routes/${editingRoute.route_id}`, 'PUT', routeData);
                setSuccessMessage(`Route "${routeData.route_name}" was updated successfully.`);
            } else {
                // This is a new route
                await request('/customers/delivery-routes', 'POST', routeData);
                setSuccessMessage(`Route "${routeData.route_name}" was created successfully.`);
            }
            handleCloseModal();
            fetchRoutes(); // Refresh the list after saving
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err) {
            // Re-throw the error so the form can catch it and display it
            throw new Error(err.data?.error || err.message || 'Failed to save the route.');
        }
    }, [editingRoute, fetchRoutes, handleCloseModal]);

    // Handler for toggling the active status of a route
    const handleToggleActive = useCallback(async (route) => {
        const actionText = route.is_active ? 'deactivate' : 'activate';
        if (!window.confirm(`Are you sure you want to ${actionText} the route "${route.route_name}"?`)) {
            return;
        }

        const payload = { ...route, is_active: !route.is_active };

        try {
            await request(`/customers/delivery-routes/${route.route_id}`, 'PUT', payload);
            setSuccessMessage(`Route "${route.route_name}" has been ${actionText}d.`);
            fetchRoutes();
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err) {
            setError(err.data?.error || err.message || `Failed to ${actionText} route.`);
        }
    }, [fetchRoutes]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen rounded-lg shadow">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-300">
                    <h1 className="text-2xl font-bold text-gray-800">จัดการสายจัดส่ง</h1>
                    <button
                        onClick={() => handleOpenModal(null)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 flex items-center justify-center"
                    >
                        <PlusIcon />
                        เพิ่มสายใหม่
                    </button>
                </div>

                {successMessage && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">{successMessage}</div>}
                {error && !isModalOpen && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}

                <DeliveryRouteList
                    routes={routes}
                    onEdit={handleOpenModal}
                    onToggleActive={handleToggleActive}
                    isLoading={isLoading}
                />

                <DeliveryRouteForm
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveRoute}
                    route={editingRoute}
                    existingRoutes={routes}
                />
            </div>
            <style jsx global>{`
                .input-field { /* Basic input field styling */
                    display: block;
                    width: 100%;
                    padding-left: 0.75rem; 
                    padding-right: 0.75rem;
                    padding-top: 0.5rem; 
                    padding-bottom: 0.5rem;
                    border-width: 1px;
                    border-style: solid;
                    border-color: #D1D5DB; /* gray-300 */
                    border-radius: 0.375rem; /* rounded-md */
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
                    background-color: white;
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    appearance: none;
                }
                select.input-field {
                    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
                    background-position: right 0.5rem center;
                    background-repeat: no-repeat;
                    background-size: 1.5em 1.5em;
                    padding-right: 2.5rem;
                }
                input[type="text"].input-field,
                input[type="number"].input-field,
                input[type="tel"].input-field,
                input[type="date"].input-field,
                textarea.input-field {
                    background-image: none;
                    padding-right: 0.75rem;
                }
                .input-field:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                    border-color: #6366F1; /* indigo-500 */
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5);
                }
                .input-field:disabled,
                .input-field.disabled\\:bg-gray-100:disabled { 
                    background-color: #f3f4f6; /* gray-100 */
                    color: #6b7280; /* gray-500 */
                    border-color: #e5e7eb; /* gray-200 */
                    cursor: not-allowed;
                    opacity: 0.7;
                }
                .btn-primary { /* Example for a primary button style */
                    background-color: #4f46e5; /* indigo-600 */
                    color: white;
                    padding: 0.625rem 1.25rem; /* py-2.5 px-5 */
                    font-weight: 500; /* font-medium */
                    font-size: 0.875rem; /* text-sm */
                    border-radius: 0.5rem; /* rounded-lg */
                    box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06); /* shadow-md */
                }
                .btn-primary:hover {
                    background-color: #4338ca; /* indigo-700 */
                }
                .btn-primary:disabled {
                    opacity: 0.5;
                }
            `}</style>
        </div>
    );
}