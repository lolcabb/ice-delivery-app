import React from 'react';
import { X, Package } from 'lucide-react';

const TireFormModal = ({ 
    isOpen, 
    onClose, 
    onSubmit, 
    tireForm, 
    setTireForm, 
    loading = false, 
    isEdit = false 
}) => {
    if (!isOpen) return null;

    const handleInputChange = (field, value) => {
        setTireForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = () => {
        // Basic validation
        if (!tireForm.serial_number || !tireForm.brand || !tireForm.sidewall) {
            alert('Please fill in all required fields');
            return;
        }
        onSubmit();
    };

    // Helper to get today's date in YYYY-MM-DD format
    const getTodayDate = () => {
        return new Date().toISOString().split('T')[0];
    };

    // Common tire brands for quick selection
    const commonBrands = [
        'Bridgestone',
        'Michelin',
        'Goodyear',
        'Yokohama',
        'Dunlop',
        'Hankook',
    ];

    // Common sidewall sizes for trucks and vehicles
    const commonSidewalls = [
        '225/75R15 XCD2',
        '205/70R15 R611',
        '7.50R16 R156',
        '8.25R16 R156',
        '9.00R20 M789',
        '11R22.5 16PR R157'
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Package className="w-5 h-5 text-green-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {isEdit ? 'Edit Tire' : 'Add New Tire'}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        {/* Serial Number */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                หมายเลขรหัสภายใน *
                            </label>
                            <input
                                type="text"
                                value={tireForm.serial_number || ''}
                                onChange={(e) => handleInputChange('serial_number', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="เช่น, BR-001-2024"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                รหัสระบุเฉพาะสำหรับติดตามยางเส้นนี้
                            </p>
                        </div>

                        {/* Brand */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ยี่ห้อ *
                            </label>
                            <div className="space-y-2">
                                <select
                                    value={tireForm.brand || ''}
                                    onChange={(e) => handleInputChange('brand', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                >
                                    <option value="">เลือกยี่ห้อ</option>
                                    {commonBrands.map(brand => (
                                        <option key={brand} value={brand}>{brand}</option>
                                    ))}
                                    <option value="Other">อื่นๆ (ระบุ)</option>
                                </select>
                                
                                {/* Custom brand input if "Other" is selected */}
                                {tireForm.brand === 'Other' && (
                                    <input
                                        type="text"
                                        placeholder="Enter custom brand name"
                                        onChange={(e) => handleInputChange('brand', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Sidewall Size */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ขนาดแก้มยาง *
                            </label>
                            <div className="space-y-2">
                                <select
                                    value={tireForm.sidewall || ''}
                                    onChange={(e) => handleInputChange('sidewall', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                >
                                    <option value="">เลือกขนาด</option>
                                    {commonSidewalls.map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                    <option value="Custom">ขนาดอื่นๆ</option>
                                </select>
                                
                                {/* Custom sidewall input if "Custom" is selected */}
                                {tireForm.sidewall === 'Custom' && (
                                    <input
                                        type="text"
                                        placeholder="เช่น, 265/70R16"
                                        onChange={(e) => handleInputChange('sidewall', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                                    />
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                ข้อมูลจำเพาะขนาดยาง (ความกว้าง/อัตราส่วนด้าน/เส้นผ่านศูนย์กลาง)
                            </p>
                        </div>

                        {/* Purchase Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                วันที่จัดซื้อ (ไม่บังคับ)
                            </label>
                            <input
                                type="date"
                                value={tireForm.purchase_date || ''}
                                onChange={(e) => handleInputChange('purchase_date', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                max={getTodayDate()}
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                สถานะ
                            </label>
                            <select
                                value={tireForm.status || 'In Stock'}
                                onChange={(e) => handleInputChange('status', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            >
                                <option value="In Stock">ในคลัง</option>
                                <option value="Retired">เลิกใช้</option>
                                {/* Note: "On Vehicle" status should be set through assignment, not manually */}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                หมายเหตุ: สถานะ "ติดรถ" จะถูกตั้งค่าโดยอัตโนมัติเมื่อมีการกำหนดยาง
                            </p>
                        </div>
                    </div>

                    {/* Required fields notice */}
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-xs text-yellow-800">
                            <strong>Note:</strong> จำเป็นต้องกรอกช่องที่มีเครื่องหมาย *
                            หมายเลขรหัสภายในควรไม่ซ้ำกันเพื่อการติดตามที่ถูกต้อง.
                        </p>
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
                            {loading ? (isEdit ? 'Updating...' : 'Adding...') : (isEdit ? 'แก้ไขยาง' : 'เพิ่มยาง')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TireFormModal;