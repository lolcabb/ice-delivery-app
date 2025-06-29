// src/salesops/DriverForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../Modal'; // Adjust path if needed

const DriverForm = ({ isOpen, onClose, onSave, driver }) => {
    const getInitialFormState = useCallback(() => ({
        name: '', // Changed from first_name
        phone_number: '',
        license_plate: '',
        is_active: true,
        notes: ''
    }), []);

    const [formData, setFormData] = useState(getInitialFormState());
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isEditing = Boolean(driver && driver.driver_id);

    useEffect(() => {
        if (isOpen) {
            if (isEditing && driver) {
                setFormData({
                    name: driver.name || '', // Corrected: Use driver.name for consistency
                    phone_number: driver.phone_number || '',
                    license_plate: driver.license_plate || '',
                    is_active: driver.is_active === undefined ? true : driver.is_active,
                    notes: driver.notes || ''
                });
            } else {
                setFormData(getInitialFormState());
            }
            setError('');
        }
    }, [isOpen, driver, isEditing, getInitialFormState]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!formData.name.trim()) { // Validate 'name'
            setError('Name is required.');
            return;
        }

        setIsLoading(true);
        try {
            // Construct payload for backend: send 'name' as 'first_name'
            const payload = {
                name: formData.name, // Backend expects first_name
                // last_name will be implicitly null or handled by backend
                phone_number: formData.phone_number,
                license_plate: formData.license_plate,
                is_active: formData.is_active,
                notes: formData.notes
            };
            await onSave(payload); 
        } catch (err) {
            console.error("Error in DriverForm submit:", err);
            setError(err.data?.error || err.message || 'บันทึกข้อมูลพนักงานขับรถไม่สำเร็จ');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'แก้ไขข้อมูลพนักงานขับรถ' : 'เพิ่มพนักงานขับรถใหม่'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">ชื่อ *</label>
                    <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className="w-full input-field" required disabled={isLoading} />
                </div>
                {/* Last Name input removed */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-1">หมายเลขโทรศัพท์</label>
                        <input type="tel" name="phone_number" id="phone_number" value={formData.phone_number} onChange={handleChange} className="w-full input-field" placeholder="เช่น 0812345678" disabled={isLoading} />
                    </div>
                    <div>
                        <label htmlFor="license_plate" className="block text-sm font-medium text-gray-700 mb-1">หมายเลขทะเบียนรถ</label>
                        <input type="text" name="license_plate" id="license_plate" value={formData.license_plate} onChange={handleChange} className="w-full input-field" placeholder="เช่น กก 1234" disabled={isLoading} />
                    </div>
                </div>

                <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                    <textarea name="notes" id="notes" value={formData.notes} onChange={handleChange} rows="3" className="w-full input-field" placeholder="หมายเหตุที่เกี่ยวข้องกับพนักงานขับรถ" disabled={isLoading}></textarea>
                </div>

                <div className="flex items-center">
                    <input
                        id="is_active_driver"
                        name="is_active"
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={handleChange}
                        className="h-4 w-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500 disabled:opacity-50"
                        disabled={isLoading}
                    />
                    <label htmlFor="is_active_driver" className="ml-2 block text-sm text-gray-900">
                        พนักงานขับรถทำงานอยู่
                    </label>
                </div>
                
                {error && (
                    <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm">
                        <p>{error}</p>
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60">
                        ยกเลิก
                    </button>
                    <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 border border-transparent rounded-md shadow-sm hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-60 disabled:bg-cyan-400 flex items-center justify-center">
                        {isLoading ? 'กำลังบันทึก...' : (isEditing ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มพนักงานขับรถ')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default DriverForm;
