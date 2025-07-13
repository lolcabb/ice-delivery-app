import React from 'react';
import { X, MapPin, Truck, Package } from 'lucide-react';

const TireAssignmentModal = ({ 
    isOpen, 
    onClose, 
    onSubmit, 
    assignmentForm, 
    setAssignmentForm, 
    selectedTire, 
    vehicles = [],
    loading = false 
}) => {
    if (!isOpen) return null;

    const handleInputChange = (field, value) => {
        setAssignmentForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = () => {
        // Basic validation
        if (!assignmentForm.vehicle_id || !assignmentForm.position || !assignmentForm.mount_date) {
            alert('Please fill in all required fields');
            return;
        }
        onSubmit();
    };

    // Helper to get today's date in YYYY-MM-DD format
    const getTodayDate = () => {
        return new Date().toISOString().split('T')[0];
    };

    // Standard vehicle tire positions
    const tirePositions = [
        { value: 'Front-Left', label: 'Front Left' },
        { value: 'Front-Right', label: 'Front Right' },
        { value: 'Rear-Left', label: 'Rear Left' },
        { value: 'Rear-Right', label: 'Rear Right' },
        { value: 'Rear-Left-Outer', label: 'Rear Left Outer (Dual)' },
        { value: 'Rear-Left-Inner', label: 'Rear Left Inner (Dual)' },
        { value: 'Rear-Right-Outer', label: 'Rear Right Outer (Dual)' },
        { value: 'Rear-Right-Inner', label: 'Rear Right Inner (Dual)' },
        { value: 'Spare', label: 'Spare Tire' },
        { value: 'Other', label: 'Other Position' }
    ];

    // Get selected vehicle details
    const selectedVehicle = vehicles.find(v => v.vehicle_id === parseInt(assignmentForm.vehicle_id));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <MapPin className="w-5 h-5 text-blue-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Assign Tire to Vehicle
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Tire Information Banner */}
                    <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-3 mb-2">
                            <Package className="w-5 h-5 text-green-600" />
                            <h3 className="font-medium text-green-900">Tire Information</h3>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-green-800">
                                <span className="font-medium">Serial:</span> {selectedTire?.serial_number}
                            </p>
                            <p className="text-sm text-green-800">
                                <span className="font-medium">Brand:</span> {selectedTire?.brand}
                            </p>
                            <p className="text-sm text-green-800">
                                <span className="font-medium">Size:</span> <span className="font-mono">{selectedTire?.sidewall}</span>
                            </p>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        {/* Vehicle Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Select Vehicle *
                            </label>
                            <select
                                value={assignmentForm.vehicle_id || ''}
                                onChange={(e) => handleInputChange('vehicle_id', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Choose a vehicle</option>
                                {vehicles
                                    .filter(vehicle => vehicle.status === 'Active') // Only show active vehicles
                                    .map(vehicle => (
                                        <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                                            {vehicle.vehicle_name} ({vehicle.license_plate})
                                        </option>
                                    ))
                                }
                            </select>
                            {vehicles.length === 0 && (
                                <p className="text-xs text-red-600 mt-1">
                                    No vehicles available. Please add vehicles first.
                                </p>
                            )}
                        </div>

                        {/* Vehicle Details Display */}
                        {selectedVehicle && (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Truck className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-900">Vehicle Details</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
                                    <div>Type: {selectedVehicle.vehicle_type}</div>
                                    <div>Year: {selectedVehicle.year}</div>
                                    <div>Make: {selectedVehicle.make}</div>
                                    <div>Model: {selectedVehicle.model}</div>
                                </div>
                            </div>
                        )}

                        {/* Position Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tire Position *
                            </label>
                            <select
                                value={assignmentForm.position || ''}
                                onChange={(e) => handleInputChange('position', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Select position</option>
                                {tirePositions.map(position => (
                                    <option key={position.value} value={position.value}>
                                        {position.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                Choose the specific position where this tire will be mounted
                            </p>
                        </div>

                        {/* Custom Position Input */}
                        {assignmentForm.position === 'Other' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Custom Position *
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., Middle-Left, Front-Center"
                                    onChange={(e) => handleInputChange('position', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        )}

                        {/* Mount Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Mount Date *
                            </label>
                            <input
                                type="date"
                                value={assignmentForm.mount_date || getTodayDate()}
                                onChange={(e) => handleInputChange('mount_date', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                max={getTodayDate()}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Date when the tire was/will be mounted on the vehicle
                            </p>
                        </div>

                        {/* Notes (Optional) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notes (Optional)
                            </label>
                            <textarea
                                rows={2}
                                value={assignmentForm.notes || ''}
                                onChange={(e) => handleInputChange('notes', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Any additional notes about this tire assignment..."
                            />
                        </div>
                    </div>

                    {/* Warning Notice */}
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-xs text-yellow-800">
                            <strong>Note:</strong> This will change the tire status to "On Vehicle" and create a new assignment record. 
                            Make sure the tire is physically mounted before confirming.
                        </p>
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
                            disabled={loading || vehicles.length === 0}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Assigning...' : 'Assign Tire'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TireAssignmentModal;