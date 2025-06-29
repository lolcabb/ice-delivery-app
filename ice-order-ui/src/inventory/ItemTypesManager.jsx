// Suggested path: src/inventory/ItemTypesManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../apiService'; // Adjust path as needed
import ItemTypeList from './ItemTypeList'; // Import actual component
import ItemTypeForm from './ItemTypeForm'; // Import actual component
// Modal is used by ItemTypeForm, so no direct import needed here.

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

export default function ItemTypesManager() {
    const [itemTypes, setItemTypes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItemType, setEditingItemType] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    const fetchItemTypes = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await apiService.getInventoryItemTypes();
            setItemTypes(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch item types:", err);
            setError(err.data?.error || err.message || 'ไม่สามารถโหลดประเภทวัสดุได้.');
            if (err.status === 401) apiService.handleComponentAuthError(err, () => window.location.replace('/login'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchItemTypes();
    }, [fetchItemTypes]);

    const handleOpenModal = useCallback((itemType = null) => {
        setEditingItemType(itemType);
        setIsModalOpen(true);
        setSuccessMessage(''); setError(null);
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingItemType(null);
    }, []);

    const handleSaveItemType = useCallback(async (formDataFromForm) => {
        let opError = null;
        // Form itself will handle its own isLoading state for its submit button.
        // Manager can set global isLoading if needed for list refresh.
        // setIsLoading(true); 
        try {
            const payload = { // Construct payload based on what API expects
                type_name: formDataFromForm.type_name,
                description: formDataFromForm.description,
            };

            if (editingItemType && editingItemType.item_type_id) {
                await apiService.updateInventoryItemType(editingItemType.item_type_id, payload);
                setSuccessMessage(`ประเภทวัสดุ "${payload.type_name}" อัปเดตสำเร็จแล้ว.`);
            } else {
                await apiService.addInventoryItemType(payload);
                setSuccessMessage(`ประเภทวัสดุ "${payload.type_name}" เพิ่มเรียบร้อยแล้ว.`);
            }
            handleCloseModal(); // Close modal on successful save
            await fetchItemTypes(); // Re-fetch to show updated list
        } catch (err) {
            console.error("Error saving item type in Manager:", err);
            opError = err.message || "บันทึกประเภทวัสดุไม่สำเร็จ."; 
            // This error will be thrown, and ItemTypeForm can catch it to display in its own error state
            throw new Error(opError); 
        } finally {
            // setIsLoading(false); // Reset global loading if it was set
            if (!opError) { // Only clear global success message if no error was thrown to form
                setTimeout(() => setSuccessMessage(''), 4000); 
            }
        }
    }, [editingItemType, fetchItemTypes, handleCloseModal]);

    const handleDeleteItemType = useCallback(async (itemTypeId) => {
        const typeToDelete = itemTypes.find(t => t.item_type_id === itemTypeId);
        if (!typeToDelete) return;

        const confirmDelete = window.confirm(
            `คุณแน่ใจหรือไม่ว่าต้องการลบประเภทวัสดุ "${typeToDelete.type_name}"? การดำเนินการนี้อาจไม่สำเร็จหากประเภทนี้กำลังถูกใช้งานอยู่.`
        );
        if (confirmDelete) {
            setIsLoading(true); setError(null); setSuccessMessage('');
            try {
                await apiService.deleteInventoryItemType(itemTypeId);
                setSuccessMessage(`ประเภทวัสดุ "${typeToDelete.type_name}" ลบเรียบร้อยแล้ว.`);
                await fetchItemTypes();
            } catch (err) {
                console.error("Failed to delete item type:", err);
                setError(err.data?.error || err.message || "ไม่สามารถลบประเภทวัสดุได้ อาจมีการใช้งานอยู่.");
                if (err.status === 401) apiService.handleComponentAuthError(err, () => window.location.replace('/login'));
            } finally {
                setIsLoading(false);
                setTimeout(() => setSuccessMessage(''), 4000);
            }
        }
    }, [itemTypes, fetchItemTypes]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-[calc(100vh-theme(space.32))] rounded-lg shadow">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-3 border-b border-gray-300">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-0">
                        จัดการประเภทวัสดุในคลัง
                    </h1>
                    <button
                        onClick={() => handleOpenModal(null)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors duration-150 flex items-center justify-center"
                    >
                        <PlusIcon />
                        เพิ่มประเภทวัสดุใหม่
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
                        <button onClick={fetchItemTypes} className="ml-4 px-3 py-1 text-xs bg-red-200 hover:bg-red-300 rounded-md font-semibold">ลองใหม่</button>
                    </div>
                )}

                <ItemTypeList
                    itemTypes={itemTypes}
                    onEdit={handleOpenModal}
                    onDelete={handleDeleteItemType}
                    isLoading={isLoading}
                />

                <ItemTypeForm
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveItemType}
                    itemType={editingItemType}
                    availableItemTypes={itemTypes} 
                />
            </div>
             <style jsx global>{`
                .input-field { 
                    display: block;
                    width: 100%;
                    padding-left: 0.75rem; padding-right: 0.75rem;
                    padding-top: 0.5rem; padding-bottom: 0.5rem;
                    border-width: 1px; border-color: #D1D5DB; 
                    border-radius: 0.375rem; 
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); 
                }
                .input-field:focus {
                    outline: 2px solid transparent; outline-offset: 2px;
                    border-color: #6366F1; 
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5); 
                }
            `}</style>
        </div>
    );
}
