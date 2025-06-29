// src/expenses/ExpenseListManager.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../apiService'; 
import ExpenseList from './ExpenseList'; 
import ExpenseForm from './ExpenseForm'; 

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

// --- Step 1: Extract FilterSection into a separate, memoized component ---
const FilterSection = React.memo(({ filters, localPaymentMethodInput, categories, onFilterChange, onApplyFilters, isLoading, isFiltering }) => {
    return (
        <div className="mb-6 p-4 bg-white shadow rounded-lg">
            <h3 className="text-md font-semibold text-gray-700 mb-3">กรองค่าใช้จ่าย</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">วันที่เริ่มต้น</label>
                    <input type="date" name="startDate" id="startDate" value={filters.startDate} onChange={onFilterChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                </div>
                <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">วันที่สิ้นสุด</label>
                    <input type="date" name="endDate" id="endDate" value={filters.endDate} onChange={onFilterChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                </div>
                <div>
                    <label htmlFor="category_id_filter" className="block text-sm font-medium text-gray-700">หมวดหมู่</label>
                    <select name="category_id" id="category_id_filter" value={filters.category_id} onChange={onFilterChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        <option value="">ทุกหมวดหมู่</option>
                        {categories.map(cat => <option key={cat.category_id} value={cat.category_id}>{cat.category_name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="payment_method_filter" className="block text-sm font-medium text-gray-700">วิธีการชำระเงิน</label>
                    <input
                        type="text"
                        name="payment_method"
                        id="payment_method_filter"
                        value={localPaymentMethodInput} // Bind to local state
                        onChange={onFilterChange}
                        placeholder="เช่น เงินสด, ธนาคาร"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>
                 <div>
                    <label htmlFor="is_petty_cash_expense_filter" className="block text-sm font-medium text-gray-700">เงินสดย่อย</label>
                    <select name="is_petty_cash_expense" id="is_petty_cash_expense_filter" value={filters.is_petty_cash_expense} onChange={onFilterChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        <option value="">ทั้งหมด</option>
                        <option value="true">ใช่</option>
                        <option value="false">ไม่</option>
                    </select>
                </div>
                <div className="flex items-end col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-5">
                    <button
                        onClick={onApplyFilters}
                        disabled={isLoading || isFiltering}
                        className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150 disabled:opacity-50"
                    >
                        {isFiltering ? 'กำลังใช้ตัวกรอง...' : 'ใช้ตัวกรอง'}
                    </button>
                </div>
            </div>
        </div>
    );
});


export default function ExpenseListManager() {
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]); // To populate category dropdown in form
    const [isLoading, setIsLoading] = useState(true); // General loading state
    const [isFiltering, setIsFiltering] = useState(false); // Specific state for filter application
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, totalItems: 0 });
    const [filters, setFilters] = useState({ 
        startDate: '',
        endDate: '',
        category_id: '',
        payment_method: '',
        is_petty_cash_expense: '', // Will be 'true', 'false', or ''
    });

    const [localPaymentMethodInput, setLocalPaymentMethodInput] = useState('');
    const debounceTimeoutRef = useRef(null);

    const fetchExpenses = useCallback(async (page, currentFilters, initiatedByFilterApply = false) => {
        if (initiatedByFilterApply) {
            setIsFiltering(true);
        } else {
            setIsLoading(true);
        }
        setError(null);
        try {
            const params = { ...currentFilters, page, limit: pagination.limit };
            Object.keys(params).forEach(key => {
                if (params[key] === '' || params[key] === null || params[key] === undefined) {
                    delete params[key];
                }
            });
            const response = await apiService.getExpenses(params);
            setExpenses(Array.isArray(response.data) ? response.data : []);
            //setPagination(response.pagination || { page: 1, limit: pagination.limit, totalPages: 1, totalItems: 0 });
            setPagination(prev => ({ ...prev, ...(response.pagination || { page: 1, totalPages: 1, totalItems: 0 }) }));
        } catch (err) {
            console.error("Failed to fetch expenses:", err);
            setError(err.data?.error || err.message || 'ไม่สามารถโหลดค่าใช้จ่ายได้.');
            if (err.status === 401) {
                 apiService.handleComponentAuthError(err, () => window.location.replace('/login'));
            }
        } finally {
            setIsLoading(false);
            setIsFiltering(false);
        }
    }, [pagination.limit]); // Removed pagination.page and filters from here to avoid re-creating fetchExpenses too often. Pass them as args.

    const fetchCategoriesForForm = useCallback(async () => {
        if (categories.length === 0 || isModalOpen) {
            try {
                const data = await apiService.getExpenseCategories();
                setCategories(Array.isArray(data) ? data.filter(cat => cat.is_active) : []); 
            } catch (err) {
                console.error("Failed to fetch categories for form:", err);
            }
        }
    }, [categories.length, isModalOpen]);

    // Debounce effect for the payment method text input
    useEffect(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(() => {
            setPagination(prev => ({ ...prev, page: 1 }));
            setFilters(prev => ({ ...prev, payment_method: localPaymentMethodInput }));
        }, 500); // 500ms delay

        return () => clearTimeout(debounceTimeoutRef.current);
    }, [localPaymentMethodInput]);

    // Effect to re-fetch expenses when page or filters change
    useEffect(() => {
        fetchExpenses(pagination.page, filters);
    }, [pagination.page, filters, fetchExpenses]);

    useEffect(() => {
        fetchCategoriesForForm();
    }, [isModalOpen, fetchCategoriesForForm]);

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const handleFilterChange = useCallback((e) => {
         const { name, value } = e.target;
        if (name === 'payment_method') {
            setLocalPaymentMethodInput(value);
         } else {
            // Update main filters directly for dropdowns and date pickers
            setFilters(prev => ({ ...prev, [name]: value }));
            setPagination(prev => ({ ...prev, page: 1 }));
        }
    }, []);

    const applyFilters = useCallback(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchExpenses(1, filters, true);
    }, [filters, fetchExpenses]);


    const handleOpenModal = useCallback((expense = null) => {
        if (categories.length === 0) {
             fetchCategoriesForForm();
        }
        setEditingExpense(expense);
        setIsModalOpen(true);
        setSuccessMessage('');
        setError(null);
    }, [categories.length, fetchCategoriesForForm]);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingExpense(null);
    }, []);

    const handleSaveExpense = useCallback(async (expenseDataFromForm) => {
        let operationError = null;
        let successMsg = '';
        // Form itself will show its own loading state. Manager can show global loading if desired.
        // setIsLoading(true); 
        try {
            if (editingExpense && editingExpense.expense_id) {
                await apiService.updateExpense(editingExpense.expense_id, expenseDataFromForm);
                successMsg = `ค่าใช้จ่าย "${expenseDataFromForm.description.substring(0,20)}..." แก้ไขเรียบร้อยแล้ว.`;
            } else {
                await apiService.addExpense(expenseDataFromForm);
                successMsg = `ค่าใช้จ่าย "${expenseDataFromForm.description.substring(0,20)}..." เพิ่มเรียบร้อยแล้ว.`;
            }
            setSuccessMessage(successMsg);
            handleCloseModal(); 
            await fetchExpenses(editingExpense ? pagination.page : 1, filters); 
        } catch (err) {
            console.error("Error saving expense in Manager:", err);
            operationError = err.data?.error || err.message || 'บันทึกค่าใช้จ่ายไม่สำเร็จ.';
            throw new Error(operationError); 
        } finally {
            // setIsLoading(false);
            if (!operationError) { 
                setTimeout(() => setSuccessMessage(''), 4000);
            }
        }
    }, [editingExpense, fetchExpenses, filters, pagination.page, handleCloseModal]);

    const handleDeleteExpense = useCallback(async (expenseId) => {
        const expenseToDelete = expenses.find(exp => exp.expense_id === expenseId);
        if (!expenseToDelete) return;

        const confirmAction = window.confirm(
            `คุณแน่ใจหรือไม่ว่าต้องการลบค่าใช้จ่าย: "${expenseToDelete.description}"? การกระทำนี้ไม่สามารถย้อนกลับได้.`
        );

        if (confirmAction) {
            setIsLoading(true); 
            setError(null);
            setSuccessMessage('');
            try {
                await apiService.deleteExpense(expenseId);
                setSuccessMessage(`ค่าใช้จ่าย "${expenseToDelete.description}" ถูกลบเรียบร้อยแล้ว.`);
                const newTotalItems = pagination.totalItems - 1;
                const newTotalPages = Math.ceil(newTotalItems / pagination.limit);
                let newCurrentPage = pagination.page;

                if (pagination.page > newTotalPages && newTotalPages > 0) {
                    newCurrentPage = newTotalPages; 
                } else if (expenses.length === 1 && pagination.page > 1) { 
                    newCurrentPage = pagination.page - 1;
                }
                if (newTotalItems === 0) newCurrentPage = 1;

                await fetchExpenses(newCurrentPage, filters);

            } catch (err) {
                console.error("Failed to delete expense:", err);
                setError(err.data?.error || err.message || 'ไม่สามารถลบค่าใช้จ่ายได้.');
                 if (err.status === 401) {
                    apiService.handleComponentAuthError(err, () => window.location.replace('/login'));
                }
            } finally {
                setIsLoading(false);
                setTimeout(() => setSuccessMessage(''), 4000);
            }
        }
    }, [expenses, pagination.page, pagination.limit, pagination.totalItems, fetchExpenses]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-[calc(100vh-theme(space.32))] rounded-lg shadow">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-3 border-b border-gray-300">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-0">
                        รายการค่าใช้จ่ายทั้งหมด
                    </h1>
                    <button
                        onClick={() => handleOpenModal(null)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150 flex items-center justify-center"
                    >
                        <PlusIcon />
                        บันทึกรายการค่าใช้จ่ายใหม่
                    </button>
                </div>

                {successMessage && (
                    <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded-md text-sm shadow">
                        {successMessage}
                    </div>
                )}

                {error && !isModalOpen && ( 
                    <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm shadow">
                        <strong>ข้อผิดพลาด:</strong> {error}
                        <button 
                            onClick={() => fetchExpenses(pagination.page, filters)} 
                            className="ml-4 px-3 py-1 text-xs bg-red-200 hover:bg-red-300 rounded-md font-semibold"
                        >
                            ลองโหลดใหม่
                        </button>
                    </div>
                )}

                <FilterSection
                    filters={filters}
                    localPaymentMethodInput={localPaymentMethodInput}
                    categories={categories}
                    onFilterChange={handleFilterChange}
                    onApplyFilters={applyFilters}
                    isLoading={isLoading}
                    isFiltering={isFiltering}
                />

                <ExpenseList
                    expenses={expenses}
                    onEdit={handleOpenModal}
                    onDelete={handleDeleteExpense}
                    isLoading={isLoading} // Pass general isLoading for the list
                    pagination={pagination}
                    onPageChange={handlePageChange}
                />

                <ExpenseForm
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveExpense}
                    expense={editingExpense}
                    categories={categories} 
                />
            </div>
        </div>
    );
}

