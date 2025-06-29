// ice-delivery-app/ice-order-ui/src/crm/DeliveryRouteForm.jsx
import React, { useState, useEffect } from 'react';
import Modal from '../Modal';

const DeliveryRouteForm = ({ isOpen, onClose, onSave, route, existingRoutes = [] }) => {
    const [formData, setFormData] = useState({ route_name: '', route_description: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = Boolean(route && route.route_id);

    useEffect(() => {
        if (isOpen) {
            if (isEditing) {
                setFormData({
                    route_name: route.route_name || '',
                    route_description: route.route_description || ''
                });
            } else {
                setFormData({ route_name: '', route_description: '' });
            }
            setError('');
        }
    }, [isOpen, route, isEditing]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const trimmedName = formData.route_name.trim();

        if (!trimmedName) {
            setError('Route name is required.');
            return;
        }

        // Check for duplicate names
        if (existingRoutes.some(r => r.route_name.toLowerCase() === trimmedName.toLowerCase() && r.route_id !== route?.route_id)) {
            setError('This route name already exists.');
            return;
        }

        setIsLoading(true);
        try {
            await onSave({
                route_name: trimmedName,
                route_description: formData.route_description.trim()
            });
        } catch (err) {
            setError(err.message || 'An error occurred while saving.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Delivery Route' : 'Create New Delivery Route'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="route_name" className="block text-sm font-medium text-gray-700">ชื่อสายจัดส่ง *</label>
                    <input
                        type="text"
                        name="route_name"
                        id="route_name"
                        value={formData.route_name}
                        onChange={handleChange}
                        className="mt-1 w-full input-field"
                        required
                        disabled={isLoading}
                    />
                </div>
                <div>
                    <label htmlFor="route_description" className="block text-sm font-medium text-gray-700">รายละเอียด (ถ้ามี)</label>
                    <textarea
                        name="route_description"
                        id="route_description"
                        value={formData.route_description}
                        onChange={handleChange}
                        rows="3"
                        className="mt-1 w-full input-field"
                        disabled={isLoading}
                    ></textarea>
                </div>
                {error && <div className="text-red-600 text-sm">{error}</div>}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-gray-200 rounded-md">ยกเลิก</button>
                    <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md">
                        {isLoading ? 'กำลังบันทึก...' : 'บันทึกสายจัดส่ง'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default DeliveryRouteForm;