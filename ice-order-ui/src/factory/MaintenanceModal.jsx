import React from 'react';
import { X, Wrench } from 'lucide-react';
import { getISODate } from '../utils/dateUtils';

const MaintenanceModal = ({ 
    isOpen, 
    onClose, 
    onSubmit, 
    maintenanceForm, 
    setMaintenanceForm, 
    selectedVehicle, 
    loading = false 
}) => {
    if (!isOpen) return null;

    const handleInputChange = (field, value) => {
        setMaintenanceForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = () => {
        // Basic validation
        if (!maintenanceForm.maintenance_date || !maintenanceForm.description) {
            alert('Please fill in the maintenance date and description');
            return;
        }
        onSubmit();
    };

    // Helper to get today's date in YYYY-MM-DD format
    const getTodayDate = () => {
        return getISODate(new Date());
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Wrench className="w-5 h-5 text-green-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                เพิ่มบันทึกการบำรุงรักษา
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Vehicle Info Banner */}
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h3 className="font-medium text-blue-900 mb-1">ข้อมูลยานพาหนะ</h3>
                        <p className="text-sm text-blue-800">
                            <span className="font-medium">{selectedVehicle?.vehicle_name}</span>
                            {selectedVehicle?.license_plate && (
                                <span> • {selectedVehicle.license_plate}</span>
                            )}
                        </p>
                        {selectedVehicle?.make && selectedVehicle?.model && (
                            <p className="text-xs text-blue-600 mt-1">
                                {selectedVehicle.make} {selectedVehicle.model} {selectedVehicle.year}
                            </p>
                        )}
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        {/* Maintenance Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                วันที่ซ่อมบำรุง *
                            </label>
                            <input
                                type="date"
                                value={maintenanceForm.maintenance_date || getTodayDate()}
                                onChange={(e) => handleInputChange('maintenance_date', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                max={getTodayDate()}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                รายละเอียดงาน *
                            </label>
                            <textarea
                                rows={4}
                                value={maintenanceForm.description || ''}
                                onChange={(e) => handleInputChange('description', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="รายละเอียดงานที่ทำ (เช่น เปลี่ยนน้ำมันเครื่อง, ตรวจเบรก)"
                            />
                        </div>

                        {/* Cost */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ค่าใช้จ่าย (ถ้ามี)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">฿</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={maintenanceForm.cost || ''}
                                    onChange={(e) => handleInputChange('cost', e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Next Maintenance Due */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                กำหนดซ่อมบำรุงครั้งต่อไป (ถ้ามี)
                            </label>
                            <input
                                type="date"
                                value={maintenanceForm.next_maintenance_due || ''}
                                onChange={(e) => handleInputChange('next_maintenance_due', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                min={getTodayDate()}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                กำหนดวันที่เตือนการซ่อมบำรุงครั้งต่อไป
                            </p>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'กำลังเพิ่ม...' : 'เพิ่มบันทึก'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaintenanceModal;