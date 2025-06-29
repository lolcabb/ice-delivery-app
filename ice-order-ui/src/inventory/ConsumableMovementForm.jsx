// Suggested path: src/inventory/ConsumableMovementForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../Modal';
import { getCurrentLocalDateISO } from '../utils/dateUtils';

// Define static initial state outside the component for a stable reference
const INITIAL_MOVEMENT_FORM_STATE = {
    movement_type: 'out', // Default to 'out'
    quantity_changed: '',
    notes: '',
    movement_date: getCurrentLocalDateISO(), // Default to today
};

const ConsumableMovementForm = ({
    isOpen,
    onClose,
    onSave, // Function from ConsumablesManager to handle API call
    consumable // The consumable item for which movement is being recorded
}) => {
    /*const initialFormState = {
        movement_type: 'out', // Default to 'out' as it's a common operation
        quantity_changed: '',
        notes: '',
    };*/
    const getInitialFormState = useCallback(() => ({
        ...INITIAL_MOVEMENT_FORM_STATE,
    }), []);

    const [formData, setFormData] = useState(getInitialFormState());
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Reset form when modal opens, but keep consumable context
            setFormData(getInitialFormState());
            setError('');
        }
    }, [isOpen, getInitialFormState]); // Only reset on isOpen change

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Basic Validation
        if (!formData.movement_date) { setError('Please specify the movement date.'); return;}
        if (!formData.movement_type) { setError('กรุณาระบุประเภทการเคลื่อนไหว'); return; }
        if (!formData.quantity_changed || isNaN(parseInt(formData.quantity_changed))) {
            setError('จำนวนต้องเป็นตัวเลขที่ถูกต้อง'); return;
        }
        
        const quantity = parseInt(formData.quantity_changed);
        if (quantity === 0 && formData.movement_type !== 'adjustment') { // Allow 0 for adjustment if needed, but typically not for in/out
             setError('จำนวนต้องไม่เป็นศูนย์สำหรับประเภท "รับเข้า" หรือ "จ่ายออก"'); return;
        }
        if (quantity <= 0 && (formData.movement_type === 'in' || formData.movement_type === 'out')) {
             setError('จำนวนต้องเป็นค่าบวกสำหรับการเคลื่อนไหวประเภท "รับเข้า" หรือ "จ่ายออก"'); return;
        }

        // For 'adjustment', quantity can be negative or positive.
        // The backend will handle the logic of adding/subtracting based on movement_type.

        setIsLoading(true);
        try {
            const payload = {
                movement_type: formData.movement_type,
                // Backend expects quantity_changed to reflect the actual change.
                // For 'out', it expects a positive number that it will then deduct.
                // For 'adjustment', it can be positive or negative.
                quantity_changed: quantity, 
                notes: formData.notes.trim() || null,
                movement_date: formData.movement_date, // Ensure movement_date is included
            };
            await onSave(payload); // This calls handleSaveMovement in ConsumablesManager
            // Parent (ConsumablesManager) will handle closing modal & re-fetching.
        } catch (err) {
            console.error("Error in ConsumableMovementForm submit:", err);
            setError(err.message || 'บันทึกการเคลื่อนไหวสต็อกไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองอีกครั้ง');
        } finally {
            setIsLoading(false);
        }
    };

    if (!consumable) return null; // Don't render if no consumable context
    if (!consumable && isOpen) {
        console.error("ConsumableMovementForm opened without a valid consumable prop.");
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Error">
                <p className="text-red-500">ข้อมูลการเคลื่อนไหวไม่ครบถ้วน ไม่สามารถบันทึกการเคลื่อนไหวได้</p>
                 <div className="flex justify-end mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">ปิด</button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`บันทึกการเคลื่อนไหวสต็อกสำหรับ: ${consumable.consumable_name} (${consumable.current_stock_level} ${consumable.unit_of_measure})`}
        >
            <div className="mb-4 text-sm bg-gray-50 p-2 rounded-md">
                Current Stock: <span className="font-bold">{consumable.current_stock_level} {consumable.unit_of_measure}</span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="movement_date" className="block text-sm font-medium text-gray-700 mb-1">
                            วันที่เคลื่อนไหว <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            name="movement_date"
                            id="movement_date"
                            value={formData.movement_date}
                            onChange={handleChange}
                            max={getCurrentLocalDateISO()} // Prevent selecting future dates
                            className="w-full input-field"
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div>
                    <label htmlFor="movement_type" className="block text-sm font-medium text-gray-700 mb-1">
                        ประเภทการเคลื่อนไหว <span className="text-red-500">*</span>
                    </label>
                    <select
                        name="movement_type"
                        id="movement_type"
                        value={formData.movement_type}
                        onChange={handleChange}
                        className="w-full input-field"
                        required
                        disabled={isLoading}
                    >
                        <option value="out">ออกจากสต็อก</option>
                        <option value="in">เข้าสต็อก (รับ/สั่งซื้อ)</option>
                        <option value="adjustment">ปรับปรุงสต็อก (แก้ไข)</option>
                    </select>
                    </div>
                </div>
                <div>
                    <label htmlFor="quantity_changed" className="block text-sm font-medium text-gray-700 mb-1">
                        จำนวน <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number"
                        name="quantity_changed"
                        id="quantity_changed"
                        value={formData.quantity_changed}
                        onChange={handleChange}
                        className="w-full input-field"
                        placeholder={formData.movement_type === 'adjustment' ? "เช่น 10 หรือ -5" : "เช่น 10"}
                        step="1" // Assuming whole units for consumables like bags
                        required
                        disabled={isLoading}
                    />
                    {formData.movement_type === 'adjustment' && 
                        <p className="text-xs text-gray-500 mt-1">กรุณาใส่ค่าบวกเพื่อเพิ่มสต็อก หรือค่าลบเพื่อลดสต็อก</p>
                    }
                     {formData.movement_type === 'out' && 
                        <p className="text-xs text-gray-500 mt-1">กรุณาใส่ค่าบวกที่แสดงถึงจำนวนที่ใช้</p>
                    }
                </div>
                
                <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                        หมายเหตุ/อ้างอิง (ไม่บังคับ)
                    </label>
                    <textarea
                        name="notes"
                        id="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        rows="3"
                        className="w-full input-field"
                        placeholder="เช่น การใช้งานประจำวัน, PO#123, การตรวจนับสต็อก"
                        disabled={isLoading}
                    ></textarea>
                </div>
                
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                        <p>{error}</p>
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200 mt-5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-60 disabled:bg-green-400 flex items-center justify-center"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                กำลังประมวลผล...
                            </>
                        ) : 'บันทึกการเคลื่อนไหว'}
                    </button>
                </div>
            </form>
            {/* Assuming you have global styles or Tailwind for .input-field */}
        </Modal>
    );
};

export default ConsumableMovementForm;
