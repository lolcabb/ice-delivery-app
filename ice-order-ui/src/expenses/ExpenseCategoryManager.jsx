// Suggested path: src/expenses/ExpenseCategoryManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../apiService'; // Adjust path if apiService.jsx is elsewhere (e.g., ../src/apiService)
import ExpenseCategoryList from './ExpenseCategoryList'; // Assuming in the same directory
import ExpenseCategoryForm from './ExpenseCategoryForm'; // Assuming in the same directory
// Modal is used by ExpenseCategoryForm, so no direct import needed here if form handles it.
// However, if ExpenseCategoryManager were to use a different modal directly, it would be imported.

// Simple Plus Icon for the "Add Category" button
const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);


export default function ExpenseCategoryManager() {
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null); // null for new, category object for edit
    const [successMessage, setSuccessMessage] = useState('');

    const fetchCategories = useCallback(async () => {
        setIsLoading(true);
        setError(null); // Clear previous errors
        try {
            const data = await apiService.getExpenseCategories();
            setCategories(Array.isArray(data) ? data : []); // Ensure data is an array
        } catch (err) {
            console.error("Failed to fetch categories:", err);
            setError(err.data?.error || err.message || 'ไม่สามารถโหลดหมวดหมู่ได้ กรุณาลองอีกครั้ง');
            // Optionally, use a more sophisticated error handling like a toast notification
            // Or use the handleComponentAuthError from apiService if it's an auth issue
            if (err.status === 401) {
                 apiService.handleComponentAuthError(err, () => window.location.replace('/login')); // Example navigate
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const handleOpenModal = (category = null) => {
        setEditingCategory(category); // If category is null, it's an "add new" operation
        setIsModalOpen(true);
        setSuccessMessage(''); // Clear any previous success messages
        setError(null); // Clear errors when opening modal
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null); // Clear editing state
    };

    // This function is passed to ExpenseCategoryForm's onSave prop
    const handleSaveCategory = async (categoryDataFromForm) => {
        setIsLoading(true); // Indicate loading state for the manager
        let operationError = null;
        let successMsg = '';

        try {
            if (editingCategory && editingCategory.category_id) {
                // Update existing category
                // The form data might not include is_active if it wasn't editable in the form.
                // We ensure all necessary fields are passed for update.
                const payload = {
                    category_name: categoryDataFromForm.category_name,
                    description: categoryDataFromForm.description,
                    is_active: categoryDataFromForm.is_active !== undefined 
                               ? categoryDataFromForm.is_active 
                               : editingCategory.is_active, // Preserve current active status if not in form
                };
                await apiService.updateExpenseCategory(editingCategory.category_id, payload);
                successMsg = `หมวดหมู่ "${payload.category_name}" อัปเดตสำเร็จแล้ว.`;
            } else {
                // Add new category
                // is_active will default to true on the backend or can be set here if needed
                const payload = {
                    category_name: categoryDataFromForm.category_name,
                    description: categoryDataFromForm.description,
                    // is_active: true, // Or let backend default it
                };
                await apiService.addExpenseCategory(payload);
                successMsg = `หมวดหมู่ "${payload.category_name}" ถูกเพิ่มเรียบร้อยแล้ว.`;
            }
            
            setSuccessMessage(successMsg);
            handleCloseModal(); // Close modal on successful save
            await fetchCategories(); // Re-fetch categories to update the list

        } catch (err) {
            console.error("Error saving category in Manager:", err);
            operationError = err.data?.error || err.message || 'บันทึกหมวดหมู่ไม่สำเร็จ.';
            // This error will be thrown, and ExpenseCategoryForm can catch it to display in its own error state
            throw new Error(operationError); 
        } finally {
            setIsLoading(false);
            if (!operationError) { // Only clear global success message if no error was thrown to form
                setTimeout(() => setSuccessMessage(''), 4000); // Hide global success message after 4 seconds
            }
        }
    };

    const handleDeleteOrToggleCategory = async (categoryId) => {
        const categoryToToggle = categories.find(c => c.category_id === categoryId);
        if (!categoryToToggle) {
            console.error("Category not found for toggling:", categoryId);
            setError("ไม่พบหมวดหมู่.");
            return;
        }

        const actionText = categoryToToggle.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน';
        const confirmAction = window.confirm(
            `คุณแน่ใจหรือไม่ว่าต้องการ ${actionText} หมวดหมู่ "${categoryToToggle.category_name}"?`
        );

        if (confirmAction) {
            setIsLoading(true);
            setError(null);
            setSuccessMessage('');
            try {
                // We need to pass all required fields for update, even if just toggling is_active
                const payload = {
                    category_name: categoryToToggle.category_name,
                    description: categoryToToggle.description,
                    is_active: !categoryToToggle.is_active // Toggle the current status
                };
                await apiService.updateExpenseCategory(categoryId, payload);
                setSuccessMessage(`หมวดหมู่ "${categoryToToggle.category_name}" ถูก ${actionText} แล้ว.`);
                await fetchCategories(); // Refresh the list
            } catch (err) {
                console.error(`Failed to ${actionText} category:`, err);
                setError(err.data?.error || err.message || `ไม่สามารถ ${actionText} หมวดหมู่ได้.`);
                if (err.status === 401) {
                    apiService.handleComponentAuthError(err, () => window.location.replace('/login'));
                }
            } finally {
                setIsLoading(false);
                setTimeout(() => setSuccessMessage(''), 4000);
            }
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-[calc(100vh-theme(space.32))] rounded-lg shadow"> {/* Adjust min-height based on your layout */}
            <div className="max-w-5xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-3 border-b border-gray-300">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-0">
                        จัดการหมวดหมู่ค่าใช้จ่าย
                    </h1>
                    <button
                        onClick={() => handleOpenModal(null)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150 flex items-center justify-center"
                    >
                        <PlusIcon />
                        เพิ่มหมวดหมู่ใหม่
                    </button>
                </div>

                {successMessage && (
                    <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded-md text-sm shadow">
                        {successMessage}
                    </div>
                )}

                {error && !isModalOpen && ( // Don't show global error if modal is open (modal has its own error display)
                    <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm shadow">
                        <strong>ข้อผิดพลาด:</strong> {error}
                        <button 
                            onClick={fetchCategories} 
                            className="ml-4 px-3 py-1 text-xs bg-red-200 hover:bg-red-300 rounded-md font-semibold"
                        >
                            ลองอีกครั้ง
                        </button>
                    </div>
                )}

                <ExpenseCategoryList
                    categories={categories}
                    onEdit={handleOpenModal} // Pass the function to handle opening modal for edit
                    onDeleteOrToggle={handleDeleteOrToggleCategory} // Pass the function to handle delete/toggle
                    isLoading={isLoading}
                />

                {/* The ExpenseCategoryForm is rendered here but controlled by isModalOpen */}
                {/* It uses the Modal component internally */}
                <ExpenseCategoryForm
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveCategory} // This will trigger add or update logic
                    category={editingCategory} // Pass current category for editing, or null for new
                    availableCategories={categories} // For duplicate name checking
                />
            </div>
        </div>
    );
}
