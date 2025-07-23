// Suggested path: src/inventory/ConsumablesManager.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { request } from '../api/base.js';
import { handleComponentAuthError } from '../api/helpers.js';

// Import the actual components
import ConsumablesList from './ConsumablesList';
import ConsumableForm from './ConsumableForm'; 
import ConsumableMovementForm from './ConsumableMovementForm';

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

// --- Step 1: Extract FilterControls into a separate, memoized component ---
const FilterControls = React.memo(({ filters, localSearchTerm, itemTypes, onFilterChange, onApplyFilters, isLoading }) => {
    return (
        <div className="mb-6 p-4 bg-white shadow rounded-lg">
            <h3 className="text-md font-semibold text-gray-700 mb-3">กรองรายการวัสดุสิ้นเปลือง</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="search_consumable" className="block text-sm font-medium text-gray-700">ค้นหาชื่อ/หมายเหตุ</label>
                    <input
                        type="text"
                        name="search"
                        id="search_consumable"
                        value={localSearchTerm} // Bind to local state
                        onChange={onFilterChange}
                        placeholder="ป้อนชื่อหรือหมายเหตุ"
                        className="mt-1 input-field"
                    />
                </div>
                <div>
                    <label htmlFor="item_type_id_filter_consumable" className="block text-sm font-medium text-gray-700">ประเภทวัสดุ</label>
                    <select
                        name="item_type_id"
                        id="item_type_id_filter_consumable"
                        value={filters.item_type_id}
                        onChange={onFilterChange}
                        className="mt-1 input-field">
                        <option value="">ทั้งหมด</option>
                        {itemTypes.map(type => <option key={type.item_type_id} value={type.item_type_id}>{type.type_name}</option>)}
                    </select>
                </div>
                <div className="flex items-end">
                    <button
                        onClick={onApplyFilters}
                        disabled={isLoading}
                        className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150 disabled:opacity-50"
                    >
                        {isLoading ? 'กำลังกรอง...' : 'ใช้ตัวกรอง'}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default function ConsumablesManager() {
    const [consumables, setConsumables] = useState([]);
    const [itemTypes, setItemTypes] = useState([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [isConsumableFormOpen, setIsConsumableFormOpen] = useState(false);
    const [editingConsumable, setEditingConsumable] = useState(null);
    const [isMovementFormOpen, setIsMovementFormOpen] = useState(false);
    const [movementTargetConsumable, setMovementTargetConsumable] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, totalItems: 0 });
    const [filters, setFilters] = useState({ item_type_id: '', search: '' });

    const [localSearchTerm, setLocalSearchTerm] = useState('');
    const debounceTimeoutRef = useRef(null);

    const fetchConsumables = useCallback(async (pageArg, filtersArg) => {
        const pageToFetch = pageArg !== undefined ? pageArg : pagination.page;
        const currentFiltersToUse = filtersArg !== undefined ? filtersArg : filters;

        setIsLoading(true);
        setError(null);
        try {
            const params = { ...currentFiltersToUse, page: pageToFetch, limit: pagination.limit };
            Object.keys(params).forEach(key => {
                if (params[key] === '' || params[key] === null || params[key] === undefined) {
                    delete params[key];
                }
            });
            const response = await request(`/inventory/consumables?${new URLSearchParams(params).toString()}`);
            setConsumables(Array.isArray(response.data) ? response.data : []);
            setPagination(prevPagination => ({
                ...prevPagination,
                ...(response.pagination || { page: 1, totalPages: 1, totalItems: 0 })
            }));
        } catch (err) {
            console.error("Failed to fetch consumables:", err);
            setError(err.data?.error || err.message || 'Could not load consumable items.');
            if (err.status === 401) handleComponentAuthError(err, () => window.location.replace('/login'));
        } finally {
            setIsLoading(false);
        }
    }, [pagination.limit, filters, pagination.page]);

    // --- **FIX**: Restored the missing function ---
    const fetchItemTypesForConsumables = useCallback(async () => {
        if (itemTypes.length === 0 || isConsumableFormOpen) {
            try {
                const { data } = await request('/inventory/item-types');
                setItemTypes(Array.isArray(data) ? data.filter(type => type.is_active !== false) : []);
            } catch (err) {
                console.error("Failed to fetch item types for consumables forms:", err);
                setError(prevError => prevError || "ไม่สามารถโหลดประเภทวัสดุสิ้นเปลืองได้");
            }
        }
    }, [itemTypes.length, isConsumableFormOpen]);

    useEffect(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(() => {
            setPagination(prev => ({ ...prev, page: 1 }));
            setFilters(prev => ({ ...prev, search: localSearchTerm }));
        }, 500);

        return () => clearTimeout(debounceTimeoutRef.current);
    }, [localSearchTerm]);

    // Initial fetch and re-fetch on explicit filter/page change
    useEffect(() => {
        fetchConsumables(pagination.page, filters);
    }, [pagination.page, filters, fetchConsumables]); // Main data fetch trigger

    useEffect(() => {
        fetchItemTypesForConsumables();
    }, [fetchItemTypesForConsumables]);

    useEffect(() => {
        if (isConsumableFormOpen && itemTypes.length === 0) {
            fetchItemTypesForConsumables();
        }
    }, [isConsumableFormOpen, itemTypes.length, fetchItemTypesForConsumables]);

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const handleFilterChange = useCallback((e) => {
        const { name, value } = e.target;
        if (name === 'search') {
            setLocalSearchTerm(value); // Update local state for debouncing
        } else {
            setFilters(prev => ({ ...prev, [name]: value }));
            setPagination(prev => ({ ...prev, page: 1 }));
        }
    }, []);

    const applyFilters = useCallback(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        // The useEffect listening to pagination.page and filters will trigger the fetch.
    }, []);

    const handleOpenConsumableForm = useCallback((consumable = null) => {
        if (itemTypes.length === 0) fetchItemTypesForConsumables(); 
        setEditingConsumable(consumable);
        setIsConsumableFormOpen(true);
        setSuccessMessage(''); setError(null);
    }, [itemTypes.length, fetchItemTypesForConsumables]);

    const handleCloseConsumableForm = useCallback(() => {
        setIsConsumableFormOpen(false);
        setEditingConsumable(null);
    }, []);

    const handleSaveConsumable = useCallback(async (formData) => {
        let opError = null;
        try {
            if (editingConsumable && editingConsumable.consumable_id) {
                await request(`/inventory/consumables/${editingConsumable.consumable_id}`, 'PUT', formData);
                setSuccessMessage(`วัสดุสิ้นเปลือง "${formData.consumable_name}" อัปเดตสำเร็จแล้ว.`);
            } else {
                await request('/inventory/consumables', 'POST', formData);
                setSuccessMessage(`วัสดุสิ้นเปลือง "${formData.consumable_name}" ถูกเพิ่มเรียบร้อยแล้ว.`);
            }
            handleCloseConsumableForm();
            await fetchConsumables(editingConsumable ? pagination.page : 1, filters);
        } catch (err) {
            console.error("Error saving consumable:", err);
            opError = err.data?.error || err.message || "ไม่สามารถบันทึกวัสดุสิ้นเปลืองได้.";
            throw new Error(opError);
        } finally {
            if (!opError) setTimeout(() => setSuccessMessage(''), 4000);
        }
    }, [editingConsumable, pagination.page, filters, fetchConsumables, handleCloseConsumableForm]);

    const handleOpenMovementForm = useCallback((consumable) => {
        setMovementTargetConsumable(consumable);
        setIsMovementFormOpen(true);
        setSuccessMessage(''); setError(null);
    }, []);

    const handleCloseMovementForm = useCallback(() => {
        setIsMovementFormOpen(false);
        setMovementTargetConsumable(null);
    }, []);

    const handleSaveMovement = useCallback(async (movementData) => {
        if (!movementTargetConsumable) return;
        let opError = null;
        try {
            await request(`/inventory/consumables/${movementTargetConsumable.consumable_id}/movements`, 'POST', movementData);
            setSuccessMessage(`บันทึกการเคลื่อนไหวสต็อกสำหรับ "${movementTargetConsumable.consumable_name}" แล้ว.`);
            handleCloseMovementForm();
            await fetchConsumables(pagination.page, filters); 
        } catch (err) {
            console.error("Error saving movement:", err);
            opError = err.data?.error || err.message || "ไม่สามารถบันทึกการเคลื่อนไหวสต็อกได้.";
            throw new Error(opError);
        } finally {
            if (!opError) setTimeout(() => setSuccessMessage(''), 4000);
        }
    }, [movementTargetConsumable, pagination.page, filters, fetchConsumables, handleCloseMovementForm]);
    
    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-[calc(100vh-theme(space.32))] rounded-lg shadow">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-3 border-b border-gray-300">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-0">
                        จัดการวัสดุสิ้นเปลือง (บรรจุภัณฑ์, อื่นๆ)
                    </h1>
                    <button
                        onClick={() => handleOpenConsumableForm(null)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-sky-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors duration-150 flex items-center justify-center"
                    >
                        <PlusIcon />
                        เพิ่มรายการวัสดุสิ้นเปลืองใหม่
                    </button>
                </div>

                {successMessage && (
                    <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded-md text-sm shadow">
                        {successMessage}
                    </div>
                )}
                {error && !isConsumableFormOpen && !isMovementFormOpen && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm shadow">
                        <strong>ข้อผิดพลาด:</strong> {error}
                        <button onClick={() => fetchConsumables(pagination.page, filters)} className="ml-4 px-3 py-1 text-xs bg-red-200 hover:bg-red-300 rounded-md font-semibold">ลองอีกครั้ง</button>
                    </div>
                )}

                <FilterControls
                    filters={filters}
                    localSearchTerm={localSearchTerm}
                    itemTypes={itemTypes}
                    onFilterChange={handleFilterChange}
                    onApplyFilters={applyFilters}
                    isLoading={isLoading}
                />

                <ConsumablesList
                    consumables={consumables}
                    onEdit={handleOpenConsumableForm}
                    onRecordMovement={handleOpenMovementForm}
                    isLoading={isLoading}
                    pagination={pagination}
                    onPageChange={handlePageChange}
                />

                <ConsumableForm
                    isOpen={isConsumableFormOpen}
                    onClose={handleCloseConsumableForm}
                    onSave={handleSaveConsumable}
                    consumable={editingConsumable}
                    itemTypes={itemTypes}
                />
                
                <ConsumableMovementForm
                    isOpen={isMovementFormOpen}
                    onClose={handleCloseMovementForm}
                    onSave={handleSaveMovement}
                    consumable={movementTargetConsumable}
                />
            </div>
            {/* Added full styles for .input-field */}
            <style jsx global>{`
                .input-field {
                    display: block;
                    width: 100%;
                    padding-left: 0.75rem; 
                    padding-right: 0.75rem;
                    padding-top: 0.5rem; 
                    padding-bottom: 0.5rem;
                    border-width: 1px; 
                    border-color: #D1D5DB; /* Tailwind gray-300 */
                    border-radius: 0.375rem; /* Tailwind rounded-md */
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* Tailwind shadow-sm */
                    -webkit-appearance: none; /* Removes default Safari/Chrome styling for select */
                    -moz-appearance: none; /* Removes default Firefox styling for select */
                    appearance: none; /* Removes default styling for select */
                    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e"); /* Tailwind select arrow */
                    background-position: right 0.5rem center;
                    background-repeat: no-repeat;
                    background-size: 1.5em 1.5em;
                    padding-right: 2.5rem; /* Make space for the arrow */
                }
                /* Remove arrow for type=date and type=number */
                .input-field[type="date"],
                .input-field[type="number"] {
                    background-image: none;
                    padding-right: 0.75rem; /* Reset padding for these types */
                }
                .input-field[type="date"]::-webkit-calendar-picker-indicator {
                    /* You might want to style the date picker indicator or leave it default */
                }
                .input-field:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                    border-color: #6366F1; /* Tailwind indigo-500 */
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5); /* Tailwind ring-indigo-500 with opacity */
                }
                .input-field.disabled\\:bg-gray-100:disabled { /* Style for disabled inputs */
                    background-color: #f3f4f6; /* Tailwind gray-100 */
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}
