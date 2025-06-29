// Suggested path: src/inventory/ConsumableForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../Modal';

// Define static parts of the initial state outside the component
const STATIC_CONSUMABLE_FORM_FIELDS = {
    consumable_name: '',
    unit_of_measure: '',
    reorder_point: '',
    notes: '',
    // item_type_id will be set dynamically based on props
};

const ConsumableForm = ({
    isOpen,
    onClose,
    onSave, // Function from ConsumablesManager to handle API call
    consumable, // Current consumable item being edited (null if adding new)
    itemTypes = [] // Array of available inventory_item_types { item_type_id, type_name }
}) => {
    /*const initialFormState = {
        item_type_id: '',
        consumable_name: '',
        unit_of_measure: '',
        reorder_point: '',
        notes: '',
        // current_stock_level is not managed here, but through movements
    };*/
    const getInitialFormState = useCallback(() => ({
        ...STATIC_CONSUMABLE_FORM_FIELDS,
        item_type_id: itemTypes.length > 0 ? itemTypes[0].item_type_id.toString() : '',
    }), [itemTypes]);

    const [formData, setFormData] = useState(getInitialFormState());
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isEditing = Boolean(consumable && consumable.consumable_id);

    useEffect(() => {
        if (isOpen) {
            if (isEditing && consumable) {
                setFormData({
                    item_type_id: consumable.item_type_id?.toString() || '',
                    consumable_name: consumable.consumable_name || '',
                    unit_of_measure: consumable.unit_of_measure || '',
                    reorder_point: consumable.reorder_point?.toString() || '',
                    notes: consumable.notes || '',
                });
            } else {
                // Default to first item type if available for new consumable
                setFormData(getInitialFormState());
            }
            setError('');
        }
    }, [consumable, isOpen, isEditing, itemTypes, getInitialFormState]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Basic Validation
        if (!formData.item_type_id) { setError('กรุณาระบุประเภทวัสดุ'); return; }
        if (!formData.consumable_name.trim()) { setError('กรุณาระบุชื่อวัสดุสิ้นเปลือง'); return; }
        if (!formData.unit_of_measure.trim()) { setError('กรุณาระบุหน่วยนับ'); return; }
        if (formData.reorder_point && (isNaN(parseInt(formData.reorder_point)) || parseInt(formData.reorder_point) < 0)) {
            setError('จุดสั่งซื้อ ต้องเป็นตัวเลขที่ไม่เป็นลบ (หากระบุ)'); return;
        }

        setIsLoading(true);
        try {
            const payload = {
                item_type_id: parseInt(formData.item_type_id),
                consumable_name: formData.consumable_name.trim(),
                unit_of_measure: formData.unit_of_measure.trim(),
                reorder_point: formData.reorder_point ? parseInt(formData.reorder_point) : null, // Send null if empty
                notes: formData.notes.trim() || null, // Send null if empty
            };
            
            // If editing, include the consumable_id (though API might take it from URL param)
            // The onSave function in ConsumablesManager will know if it's an update or add
            if (isEditing) {
                payload.consumable_id = consumable.consumable_id;
            }

            await onSave(payload); // Call the save handler from ConsumablesManager
            // Parent (ConsumablesManager) will handle closing modal & re-fetching.
        } catch (err) {
            console.error("Error in ConsumableForm submit:", err);
            setError(err.message || 'บันทึกข้อมูลวัสดุสิ้นเปลืองไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'แก้ไขรายการวัสดุสิ้นเปลือง' : 'เพิ่มรายการวัสดุสิ้นเปลืองใหม่'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="consumable_name" className="block text-sm font-medium text-gray-700 mb-1">
                        ชื่อวัสดุสิ้นเปลือง <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="consumable_name"
                        id="consumable_name"
                        value={formData.consumable_name}
                        onChange={handleChange}
                        className="w-full input-field"
                        placeholder="เช่น ถุงพลาสติก 25 กก., เชือกฟางสีแดง"
                        required
                        disabled={isLoading}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="item_type_id" className="block text-sm font-medium text-gray-700 mb-1">
                            ประเภทวัสดุ <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="item_type_id"
                            id="item_type_id"
                            value={formData.item_type_id}
                            onChange={handleChange}
                            className="w-full input-field disabled:bg-gray-100"
                            required
                            disabled={isLoading || itemTypes.length === 0}
                        >
                            <option value="" disabled>{itemTypes.length === 0 && !isLoading ? "ไม่มีประเภทวัสดุ" : "เลือกประเภทวัสดุ"}</option>
                            {itemTypes.map(type => (
                                <option key={type.item_type_id} value={type.item_type_id.toString()}>
                                    {type.type_name}
                                </option>
                            ))}
                        </select>
                        {itemTypes.length === 0 && !isLoading && <p className="text-xs text-red-500 mt-1">ไม่พบประเภทวัสดุ กรุณากำหนดประเภทวัสดุก่อน</p>}
                    </div>
                    <div>
                        <label htmlFor="unit_of_measure" className="block text-sm font-medium text-gray-700 mb-1">
                            หน่วยนับ <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="unit_of_measure"
                            id="unit_of_measure"
                            value={formData.unit_of_measure}
                            onChange={handleChange}
                            className="w-full input-field"
                            placeholder="เช่น ชิ้น, ม้วน, กก., ใบ"
                            required
                            disabled={isLoading}
                        />
                    </div>
                </div>
                
                <div>
                    <label htmlFor="reorder_point" className="block text-sm font-medium text-gray-700 mb-1">
                        จุดสั่งซื้อ (ไม่บังคับ)
                    </label>
                    <input
                        type="number"
                        name="reorder_point"
                        id="reorder_point"
                        value={formData.reorder_point}
                        onChange={handleChange}
                        className="w-full input-field"
                        placeholder="เช่น 100"
                        min="0"
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                        หมายเหตุ (ไม่บังคับ)
                    </label>
                    <textarea
                        name="notes"
                        id="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        rows="3"
                        className="w-full input-field"
                        placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับวัสดุสิ้นเปลืองนี้"
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
                        disabled={isLoading || (itemTypes.length === 0 && !isEditing)}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-indigo-400 flex items-center justify-center"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                กำลังประมวลผล...
                            </>
                        ) : (isEditing ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มรายการ')}
                    </button>
                </div>
            </form>
            {/* Assuming you have global styles or Tailwind for .input-field */}
        </Modal>
    );
};

export default ConsumableForm;
