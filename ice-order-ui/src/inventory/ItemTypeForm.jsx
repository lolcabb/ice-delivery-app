// Suggested path: src/inventory/ItemTypeForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../Modal'; // Assuming Modal.jsx is in parent directory (e.g., src/Modal.jsx)

// Define static initial state outside the component
const STATIC_ITEM_TYPE_FORM_FIELDS = {
    type_name: '',
    description: '',
};

const ItemTypeForm = ({
    isOpen,
    onClose,
    onSave, // Function from ItemTypesManager to handle API call
    itemType, // Current item type being edited (null if adding new)
    availableItemTypes = [] // Array of existing item types for duplicate checking
}) => {
    /*const initialFormState = {
        type_name: '',
        description: '',
    };*/
    const getInitialFormState = useCallback(() => ({
        ...STATIC_ITEM_TYPE_FORM_FIELDS,
    }), []);

    const [formData, setFormData] = useState(getInitialFormState());
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isEditing = Boolean(itemType && itemType.item_type_id);

    useEffect(() => {
        if (isOpen) { // Only reset/populate when modal becomes visible
            if (isEditing && itemType) {
                setFormData({
                    type_name: itemType.type_name || '',
                    description: itemType.description || '',
                });
            } else {
                setFormData(getInitialFormState());
            }
            setError(''); // Clear any previous errors
        }
    }, [itemType, isOpen, isEditing, getInitialFormState]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const trimmedTypeName = formData.type_name.trim();
        if (!trimmedTypeName) {
            setError('กรุณาระบุชื่อประเภทวัสดุ.');
            return;
        }

        // Client-side check for duplicate name (case-insensitive)
        const isDuplicate = availableItemTypes.some(
            it => it.type_name.toLowerCase() === trimmedTypeName.toLowerCase() &&
                  (!itemType || it.item_type_id !== itemType.item_type_id)
        );

        if (isDuplicate) {
            setError('ชื่อประเภทวัสดุนี้มีอยู่แล้ว กรุณาเลือกชื่ออื่น.');
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                type_name: trimmedTypeName,
                description: formData.description.trim() || null, // Send null if empty
            };
            
            // The onSave function in ItemTypesManager will handle if it's an add or update
            await onSave(payload); 
            // Parent (ItemTypesManager) will handle closing modal & re-fetching.
        } catch (err) {
            console.error("Error in ItemTypeForm submit:", err);
            setError(err.message || 'ไม่สามารถบันทึกประเภทวัสดุได้ กรุณาตรวจสอบข้อมูล.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'แก้ไขประเภทวัสดุในคลัง' : 'เพิ่มประเภทวัสดุใหม่ในคลัง'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="type_name" className="block text-sm font-medium text-gray-700 mb-1">
                        ชื่อประเภทวัสดุ <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="type_name"
                        id="type_name"
                        value={formData.type_name}
                        onChange={handleChange}
                        className="w-full input-field"
                        placeholder="เช่น บรรจุภัณฑ์, เกลือ, เครื่องมือ"
                        required
                        disabled={isLoading}
                    />
                </div>
                
                <div>
                    <label htmlFor="description_item_type" className="block text-sm font-medium text-gray-700 mb-1">
                        รายละเอียด (ไม่บังคับ)
                    </label>
                    <textarea
                        name="description"
                        id="description_item_type"
                        value={formData.description}
                        onChange={handleChange}
                        rows="3"
                        className="w-full input-field"
                        placeholder="รายละเอียดสั้น ๆ ของประเภทวัสดุนี้"
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
                        ) : (isEditing ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มประเภทวัสดุ')}
                    </button>
                </div>
            </form>
            {/* Assuming you have global styles or Tailwind for .input-field */}
        </Modal>
    );
};

export default ItemTypeForm;
