import React from 'react';
import { X } from 'lucide-react';

const VehicleFormModal = ({ 
    isOpen, 
    onClose, 
    onSubmit, 
    vehicleForm, 
    setVehicleForm, 
    loading = false, 
    isEdit = false 
}) => {
    if (!isOpen) return null;

    const handleInputChange = (field, value) => {
        setVehicleForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = () => {
        // Basic validation
        if (!vehicleForm.vehicle_name || !vehicleForm.license_plate || !vehicleForm.vehicle_type) {
            alert('Please fill in all required fields');
            return;
        }
        onSubmit();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-gray-900">
                            {isEdit ? 'Edit Vehicle' : 'Add New Vehicle'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        {/* Vehicle Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Vehicle Name *
                            </label>
                            <input
                                type="text"
                                value={vehicleForm.vehicle_name || ''}
                                onChange={(e) => handleInputChange('vehicle_name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., Delivery Truck 01"
                            />
                        </div>

                        {/* License Plate */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                License Plate *
                            </label>
                            <input
                                type="text"
                                value={vehicleForm.license_plate || ''}
                                onChange={(e) => handleInputChange('license_plate', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., ABC-1234"
                            />
                        </div>

                        {/* Vehicle Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Vehicle Type *
                            </label>
                            <select
                                value={vehicleForm.vehicle_type || ''}
                                onChange={(e) => handleInputChange('vehicle_type', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Select Type</option>
                                <option value="Pickup">กระบะ</option>
                                <option value="6-wheel-medium-truck">รถ6ล้อกลาง</option>
                                <option value="6-wheel-large-truck">รถ6ล้อใหญ่</option>
                                <option value="10-wheel-truck">รถ10ล้อ</option>
                                <option value="Car">รถยนต์</option>
                                <option value="Other">อื่นๆ</option>
                            </select>
                        </div>

                        {/* Make and Model */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Make
                                </label>
                                <input
                                    type="text"
                                    value={vehicleForm.make || ''}
                                    onChange={(e) => handleInputChange('make', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., Toyota"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Model
                                </label>
                                <input
                                    type="text"
                                    value={vehicleForm.model || ''}
                                    onChange={(e) => handleInputChange('model', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., Hilux"
                                />
                            </div>
                        </div>

                        {/* Year */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Year
                            </label>
                            <input
                                type="number"
                                min="1950"
                                max="2030"
                                value={vehicleForm.year || ''}
                                onChange={(e) => handleInputChange('year', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., 2023"
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Status
                            </label>
                            <select
                                value={vehicleForm.status || 'Active'}
                                onChange={(e) => handleInputChange('status', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="Active">Active</option>
                                <option value="In-Shop">In-Shop</option>
                                <option value="Out of Service">Out of Service</option>
                            </select>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {loading ? (isEdit ? 'Updating...' : 'Adding...') : (isEdit ? 'Update Vehicle' : 'Add Vehicle')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VehicleFormModal;