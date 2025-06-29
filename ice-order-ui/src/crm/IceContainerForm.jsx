// Suggested path: src/inventory/IceContainerForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../Modal'; // Assuming Modal.jsx is in parent directory (e.g., src/Modal.jsx)

import { formatDateForInput } from '../utils/dateUtils';

// Define static parts of the initial state outside the component
const STATIC_ICE_CONTAINER_FIELDS = {
    serial_number: '',
    container_type: 'Loaner', // Default type
    status: 'In Stock',     // Default status for new containers
    purchase_date: '',       // Default purchase_date to empty string
    notes: '',
    current_customer_id: null,
    current_assignment_id: null,
};

const IceContainerForm = ({
    isOpen,
    onClose,
    onSave, // Function from IceContainerManager
    container, // Current container being edited (null if adding new)
    //itemTypes = [], // Array of all inventory_item_types { item_type_id, type_name }
    containerSizes = [] // Array of active ice_container_sizes { size_id, size_code, description }
}) => {
    /*const getIceContainerItemTypeId = () => {
        const iceType = itemTypes.find(it => it.type_name?.toLowerCase().includes('ice container'));
        return iceType ? iceType.item_type_id.toString() : '';
    };*/

    const getInitialFormState = useCallback(() => ({
        ...STATIC_ICE_CONTAINER_FIELDS,
        size_id: containerSizes.length > 0 ? containerSizes[0].size_id.toString() : '', // Default to empty, will be set when sizes are loaded
        current_customer_id: null,
        current_assignment_id: null,
    }), [containerSizes]);

    const [formData, setFormData] = useState(getInitialFormState);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isEditing = Boolean(container && container.container_id);

    useEffect(() => {
        //const iceContainerTypeId = getIceContainerItemTypeId();
        if (isOpen) {
            if (isEditing && container) {
                setFormData({
                    serial_number: container.serial_number || '',
                    //item_type_id: container.item_type_id?.toString() || iceContainerTypeId, // REMOVED
                    size_id: container.size_id?.toString() || '',
                    container_type: container.container_type || 'Loaner',
                    status: container.status || 'In Stock',
                    purchase_date: container.purchase_date ? formatDateForInput(container.purchase_date) : '',
                    notes: container.notes || '',
                    current_customer_id: container.current_customer_id || null,
                    current_assignment_id: container.current_assignment_id || null,
                });
            } else {
                setFormData(getInitialFormState());
            }
            setError('');
        }
    }, [container, isOpen, isEditing, containerSizes, getInitialFormState]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Basic Validation
        if (!formData.serial_number.trim()) { setError('จำเป็นต้องระบุหมายเลขซีเรียล'); return; }
        //if (!formData.item_type_id) { setError('Item Type is required.'); return; } // No item_type_id validation needed
        if (!formData.size_id) { setError('จำเป็นต้องระบุขนาดถังน้ำแข็ง'); return; }
        if (!formData.container_type) { setError('จำเป็นต้องระบุประเภทถังน้ำแข็ง'); return; }
        if (isEditing && !formData.status) { setError('จำเป็นต้องระบุสถานะเมื่อแก้ไข'); return; }


        setIsLoading(true);
        try {
            const payload = {
                ...formData,
                serial_number: formData.serial_number.trim(),
                //item_type_id: parseInt(formData.item_type_id),
                size_id: parseInt(formData.size_id),
                purchase_date: formData.purchase_date || null, // Send null if empty
                notes: formData.notes.trim() || null,
            };
            if (isEditing) {
                payload.current_customer_id = formData.current_customer_id || null;
                payload.current_assignment_id = formData.current_assignment_id || null;
            }
            // Status is only sent if editing, for new it defaults in backend or is 'In Stock'
            if (!isEditing) {
                payload.status = 'In Stock'; // Ensure new containers are 'In Stock'
                payload.current_customer_id = null;
                payload.current_assignment_id = null;
            }


            await onSave(payload); // Calls handleSaveContainer in IceContainerManager
        } catch (err) {
            console.error("Error in IceContainerForm submit:", err);
            setError(err.message || 'ไม่สามารถบันทึกถังน้ำแข็งได้');
        } finally {
            setIsLoading(false);
        }
    };
    
    //const availableItemTypes = itemTypes.filter(it => it.type_name?.toLowerCase().includes('ice container') || (isEditing && it.item_type_id === parseInt(formData.item_type_id)));


    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `แก้ไขถังน้ำแข็ง: ${formData.serial_number}` : 'เพิ่มถังน้ำแข็งใหม่'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="serial_number_container_form" className="block text-sm font-medium text-gray-700 mb-1"> {/* Changed ID for uniqueness */}
                        หมายเลขซีเรียล <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="serial_number"
                        id="serial_number_container_form"
                        value={formData.serial_number}
                        onChange={handleChange}
                        className="w-full input-field"
                        placeholder="เช่น, 25Q1/S01"
                        required
                        disabled={isLoading}
                    />
                </div>

                {/* Item Type field is completely removed */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="size_id_container_form" className="block text-sm font-medium text-gray-700 mb-1">
                            ขนาดถังน้ำแข็ง <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="size_id"
                            id="size_id_container_form"
                            value={formData.size_id}
                            onChange={handleChange}
                            className="w-full input-field disabled:bg-gray-100"
                            required
                            disabled={isLoading || containerSizes.length === 0}
                        >
                            <option value="" disabled>{containerSizes.length === 0 ? "กำลังโหลดขนาด..." : "เลือกขนาด"}</option>
                            {containerSizes.map(size => (
                                <option key={size.size_id} value={size.size_id.toString()}>
                                    {size.size_code} - {size.description || `${size.capacity_liters}L`}
                                </option>
                            ))}
                        </select>
                         {containerSizes.length === 0 && !isLoading && <p className="text-xs text-red-500 mt-1">ไม่มีขนาดถังน้ำแข็งให้เลือก</p>}
                    </div>
                    <div>
                        <label htmlFor="container_type_form" className="block text-sm font-medium text-gray-700 mb-1">
                            ประเภทถังน้ำแข็ง <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="container_type"
                            id="container_type_form"
                            value={formData.container_type}
                            onChange={handleChange}
                            className="w-full input-field"
                            required
                            disabled={isLoading}
                        >
                            <option value="Loaner">Loaner (ให้ยืม)</option>
                            <option value="CRM">CRM (ให้ลูกค้า)</option>
                        </select>
                    </div>
                </div>
                
                {isEditing && ( 
                    <div>
                        <label htmlFor="status_container_form" className="block text-sm font-medium text-gray-700 mb-1">
                            สถานะ <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="status"
                            id="status_container_form"
                            value={formData.status}
                            onChange={handleChange}
                            className="w-full input-field"
                            required
                            disabled={isLoading || formData.status === 'With Customer'} 
                        >
                            <option value="In Stock">In Stock (ในสต็อก)</option>
                            <option value="Maintenance">Maintenance (ซ่อมบำรุง)</option>
                            <option value="Damaged">Damaged (ชำรุด)</option>
                            <option value="Retired">Retired (ปลดระวาง)</option>
                            {formData.status === 'With Customer' && <option value="With Customer" disabled>With Customer (อยู่กับลูกค้า - จัดการผ่าน Assignments)</option>}
                        </select>
                         {formData.status === 'With Customer' && <p className="text-xs text-gray-500 mt-1">สถานะคือ 'อยู่กับลูกค้า' จัดการผ่านการมอบหมาย</p>}
                    </div>
                )}

                <div>
                    <label htmlFor="purchase_date_container_form" className="block text-sm font-medium text-gray-700 mb-1">
                        วันที่ซื้อ (ถ้ามี)
                    </label>
                    <input
                        type="date"
                        name="purchase_date"
                        id="purchase_date_container_form"
                        value={formData.purchase_date}
                        onChange={handleChange}
                        className="w-full input-field"
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label htmlFor="notes_container_form" className="block text-sm font-medium text-gray-700 mb-1">
                        หมายเหตุ (ถ้ามี)
                    </label>
                    <textarea
                        name="notes"
                        id="notes_container_form"
                        value={formData.notes}
                        onChange={handleChange}
                        rows="3"
                        className="w-full input-field"
                        placeholder="เช่น, สภาพ, เครื่องหมายเฉพาะ"
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
                        disabled={isLoading || (containerSizes.length === 0 && !isEditing) }
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
                        ) : (isEditing ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มถังน้ำแข็ง')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default IceContainerForm;
