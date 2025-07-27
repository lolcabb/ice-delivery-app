import React from 'react';
import { X, MapPin, Truck, Package } from 'lucide-react';
import { getISODate } from '../utils/dateUtils';

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
            alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
            return;
        }
        onSubmit();
    };

    // Helper to get today's date in YYYY-MM-DD format
    const getTodayDate = () => {
        return getISODate(new Date());
    };

    // Standard vehicle tire positions
    const tirePositions = [
        { value: 'Front-Left', label: 'หน้าซ้าย' },
        { value: 'Front-Right', label: 'หน้าขวา' },
        { value: 'Rear-Left', label: 'หลังซ้าย' },
        { value: 'Rear-Right', label: 'หลังขวา' },
        { value: 'Rear-Left-Outer', label: 'หลังซ้ายนอก (คู่)' },
        { value: 'Rear-Left-Inner', label: 'หลังซ้ายใน (คู่)' },
        { value: 'Rear-Right-Outer', label: 'หลังขวานอก (คู่)' },
        { value: 'Rear-Right-Inner', label: 'หลังขวาใน (คู่)' },
        { value: 'Spare', label: 'ยางอะไหล่' },
        { value: 'Other', label: 'ตำแหน่งอื่นๆ' }
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
                                ติดตั้งยางเข้ารถ
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
                            <h3 className="font-medium text-green-900">ข้อมูลยาง</h3>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-green-800">
                                <span className="font-medium">หมายเลขซีเรียล:</span> {selectedTire?.serial_number}
                            </p>
                            <p className="text-sm text-green-800">
                                <span className="font-medium">ยี่ห้อ:</span> {selectedTire?.brand}
                            </p>
                            <p className="text-sm text-green-800">
                                <span className="font-medium">ขนาด:</span> <span className="font-mono">{selectedTire?.sidewall}</span>
                            </p>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        {/* Vehicle Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                เลือกยานพาหนะ *
                            </label>
                            <select
                                value={assignmentForm.vehicle_id || ''}
                                onChange={(e) => handleInputChange('vehicle_id', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">เลือกยานพาหนะที่จะติดตั้งยาง</option>
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
                                    ไม่มียานพาหนะในระบบ
                                </p>
                            )}
                        </div>

                        {/* Vehicle Details Display */}
                        {selectedVehicle && (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Truck className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-900">ยานพาหนะที่เลือก</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
                                    <div>ประเภท: {selectedVehicle.vehicle_type}</div>
                                    <div>ปีผลิต: {selectedVehicle.year}</div>
                                    <div>ยี่ห้อ: {selectedVehicle.make}</div>
                                    <div>รุ่น: {selectedVehicle.model}</div>
                                </div>
                            </div>
                        )}

                        {/* Position Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ตำแหน่งยาง *
                            </label>
                            <select
                                value={assignmentForm.position || ''}
                                onChange={(e) => handleInputChange('position', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">เลือกตำแหน่งการติดตั้ง</option>
                                {tirePositions.map(position => (
                                    <option key={position.value} value={position.value}>
                                        {position.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                เลือกตำแหน่งการติดตั้งสำหรับยางรถ
                            </p>
                        </div>

                        {/* Custom Position Input */}
                        {assignmentForm.position === 'Other' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    จุดอื่นๆ *
                                </label>
                                <input
                                    type="text"
                                    placeholder="ระบุได้ว่า รถ10ล้อ รถ6ล้อ"
                                    onChange={(e) => handleInputChange('position', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        )}

                        {/* Mount Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                วันที่ติดตั้ง *
                            </label>
                            <input
                                type="date"
                                value={assignmentForm.mount_date || getTodayDate()}
                                onChange={(e) => handleInputChange('mount_date', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                max={getTodayDate()}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                วันที่ยางได้รับการติดตั้งหรือจะได้รับการติดตั้ง
                            </p>
                        </div>

                        {/* Notes (Optional) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                หมายเหตุ (ถ้ามี)
                            </label>
                            <textarea
                                rows={2}
                                value={assignmentForm.notes || ''}
                                onChange={(e) => handleInputChange('notes', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="หมายเหตุเพิ่มเติมเกี่ยวกับการติดตั้งยางนี้..."
                            />
                        </div>
                    </div>

                    {/* Warning Notice */}
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-xs text-yellow-800">
                            <strong>Note:</strong> การดำเนินการนี้จะเปลี่ยนสถานะยางเป็น "ติดตั้งแล้ว" และสร้างบันทึกการติดตั้งใหม่ 
                                กรุณาตรวจสอบให้แน่ใจว่าได้ติดตั้งยางจริงแล้วก่อนยืนยัน
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
                            disabled={loading || vehicles.length === 0}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'กำลังติดตั้ง...' : 'ติดตั้งยาง'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TireAssignmentModal;