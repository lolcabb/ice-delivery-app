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
            alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
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
                            {isEdit ? 'อัปเดตยานพาหนะ' : 'เพิ่มยานพาหนะ'}
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
                                ชื่อยานพาหนะ *
                            </label>
                            <input
                                type="text"
                                value={vehicleForm.vehicle_name || ''}
                                onChange={(e) => handleInputChange('vehicle_name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="เช่น รถสแปร์ ML1"
                            />
                        </div>

                        {/* License Plate */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ทะเบียนรถ *
                            </label>
                            <input
                                type="text"
                                value={vehicleForm.license_plate || ''}
                                onChange={(e) => handleInputChange('license_plate', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="เช่น กข-1234"
                            />
                        </div>

                        {/* Vehicle Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ประเภทยานพาหนะ *
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
                                    ยี่ห้อ
                                </label>
                                <input
                                    type="text"
                                    value={vehicleForm.make || ''}
                                    onChange={(e) => handleInputChange('make', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="เช่น Toyota"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    รุ่น
                                </label>
                                <input
                                    type="text"
                                    value={vehicleForm.model || ''}
                                    onChange={(e) => handleInputChange('model', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="เช่น Hilux"
                                />
                            </div>
                        </div>

                        {/* Year */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ปีผลิต
                            </label>
                            <input
                                type="number"
                                min="1950"
                                max="2030"
                                value={vehicleForm.year || ''}
                                onChange={(e) => handleInputChange('year', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="เช่น 2023"
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                สถานะ
                            </label>
                            <select
                                value={vehicleForm.status || 'Active'}
                                onChange={(e) => handleInputChange('status', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="Active">ใช้งาน</option>
                                <option value="In-Shop">ซ่อมบำรุง</option>
                                <option value="Out of Service">ไม่ใช้งาน</option>
                            </select>
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
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {loading ? (isEdit ? 'กำลังอัปเดต...' : 'กำลังเพิ่ม...') : (isEdit ? 'อัปเดตยานพาหนะ' : 'เพิ่มยานพาหนะ')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VehicleFormModal;