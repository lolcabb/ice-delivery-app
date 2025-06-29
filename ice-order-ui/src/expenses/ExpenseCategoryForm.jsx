// Suggested path: src/expenses/ExpenseCategoryForm.jsx
import React, { useState, useEffect } from 'react';
import Modal from '../Modal'; // Assuming Modal.jsx is in the same directory

const ExpenseCategoryForm = ({ 
    isOpen, 
    onClose, 
    onSave, // This function will be called with categoryData from ExpenseCategoryManager
    category, // Current category being edited (null if adding new)
    availableCategories = [] // Array of existing categories for duplicate checking
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Effect to populate form when a category is passed for editing or when modal opens
    useEffect(() => {
        if (isOpen) { // Only reset/populate when modal becomes visible
            if (category) {
                setName(category.category_name || '');
                setDescription(category.description || '');
            } else {
                setName('');
                setDescription('');
            }
            setError(''); // Clear any previous errors
        }
    }, [category, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Clear previous errors

        const trimmedName = name.trim();
        if (!trimmedName) {
            setError('กรุณาระบุชื่อหมวดหมู่ค่าใช้จ่าย');
            return;
        }

        // Client-side check for duplicate name (case-insensitive)
        // Exclude the current category being edited from the duplicate check
        const isDuplicate = availableCategories.some(
            cat => cat.category_name.toLowerCase() === trimmedName.toLowerCase() && 
                   (!category || cat.category_id !== category.category_id)
        );

        if (isDuplicate) {
            setError('ชื่อหมวดหมู่นี้มีอยู่แล้ว กรุณาเลือกชื่ออื่น');
            return;
        }

        setIsLoading(true);
        try {
            // The actual API call (add or update) will be handled by the `onSave` prop
            // which is passed down from ExpenseCategoryManager.
            // We just pass the data.
            const categoryData = {
                category_name: trimmedName,
                description: description.trim(),
                // is_active is handled by the parent (ExpenseCategoryManager) when updating
                // For new categories, the backend usually defaults is_active to true.
                // If editing, the parent will pass the existing is_active status.
            };
            if (category && category.category_id) {
                categoryData.category_id = category.category_id; // Include ID if editing
                categoryData.is_active = category.is_active; // Preserve active status when editing
            }

            await onSave(categoryData); // Call the save handler passed from parent
            // Parent (ExpenseCategoryManager) will handle closing modal and re-fetching data on success
            // No need to call onClose() here directly, let parent control flow.
        } catch (err) {
            // This catch block might be redundant if onSave in parent handles errors and form remains open.
            // However, it's good for catching issues if onSave itself throws an unhandled error.
            console.error("Error in ExpenseCategoryForm submit:", err);
            setError(err.data?.error || err.message || 'บันทึกหมวดหมู่ไม่สำเร็จ');
        } finally {
            setIsLoading(false);
        }
    };

    // The Modal component itself handles the isOpen logic.
    // This component just defines the content of the modal.
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={category ? 'แก้ไขหมวดหมู่ค่าใช้จ่าย' : 'เพิ่มหมวดหมู่ค่าใช้จ่ายใหม่'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="categoryName" className="block text-sm font-medium text-gray-700 mb-1">
                        ชื่อหมวดหมู่ <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="categoryName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
                        placeholder="เช่น, เครื่องใช้สำนักงาน, ซ่อมรถ"
                        required
                        disabled={isLoading}
                    />
                </div>
                <div>
                    <label htmlFor="categoryDescription" className="block text-sm font-medium text-gray-700 mb-1">
                        รายละเอียด (ไม่บังคับ)
                    </label>
                    <textarea
                        id="categoryDescription"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
                        placeholder="คำอธิบายย่อของหมวดหมู่"
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
                        ) : (category ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มหมวดหมู่')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ExpenseCategoryForm;
