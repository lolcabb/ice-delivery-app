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

// Filter Badge Component for quick selection
const FilterBadge = ({ label, isActive, onClick, color = 'indigo' }) => {
    const colorClasses = {
        indigo: isActive ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
        green: isActive ? 'bg-green-100 text-green-800 border-green-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
        blue: isActive ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md transition-colors duration-150 ${colorClasses[color]}`}
        >
            {label}
        </button>
    );
};

// Quick Date Range Selector
const QuickDateSelector = ({ onSelect, currentFilters }) => {
    const today = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];

    const quickRanges = [
        {
            label: 'วันนี้',
            startDate: formatDate(today),
            endDate: formatDate(today)
        },
        {
            label: 'สัปดาห์นี้',
            startDate: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())),
            endDate: formatDate(today)
        },
        {
            label: 'เดือนนี้',
            startDate: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
            endDate: formatDate(today)
        },
        {
            label: 'เดือนที่แล้ว',
            startDate: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
            endDate: formatDate(new Date(today.getFullYear(), today.getMonth(), 0))
        }
    ];

    const isRangeActive = (range) => {
        return currentFilters.startDate === range.startDate && currentFilters.endDate === range.endDate;
    };

    return (
        <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-600 self-center mr-2">ช่วงเวลา:</span>
            {quickRanges.map((range, index) => (
                <FilterBadge
                    key={index}
                    label={range.label}
                    isActive={isRangeActive(range)}
                    onClick={() => onSelect(range)}
                    color="indigo"
                />
            ))}
        </div>
    );
};

// Main Enhanced Filter Section Component
const EnhancedFilterSection = React.memo(({ 
    filters, 
    categories, 
    onFilterChange, 
    onApplyFilters, 
    isLoading, 
    isFiltering 
}) => {
    const [showAdvanced, setShowAdvanced] = React.useState(false);

    // Handle quick payment method selection
    const handlePaymentMethodQuickSelect = (method) => {
        const syntheticEvent = {
            target: {
                name: 'is_petty_cash_expense',
                value: method
            }
        };
        onFilterChange(syntheticEvent);
    };

    // Handle quick date range selection
    const handleQuickDateSelect = (range) => {
        // Create synthetic events to update both dates
        onFilterChange({ target: { name: 'startDate', value: range.startDate } });
        // Use setTimeout to ensure the first update completes
        setTimeout(() => {
            onFilterChange({ target: { name: 'endDate', value: range.endDate } });
        }, 0);
    };

    // Handle category quick select
    const handleCategorySelect = (categoryId) => {
        const syntheticEvent = {
            target: {
                name: 'category_id',
                value: categoryId
            }
        };
        onFilterChange(syntheticEvent);
    };

    // Handle clearing all filters
    const handleClearFilters = () => {
        const clearEvents = [
            { target: { name: 'startDate', value: '' } },
            { target: { name: 'endDate', value: '' } },
            { target: { name: 'category_id', value: '' } },
            { target: { name: 'payment_method', value: '' } },
            { target: { name: 'is_petty_cash_expense', value: '' } }
        ];
        
        clearEvents.forEach((event, index) => {
            setTimeout(() => onFilterChange(event), index * 10);
        });
    };

    // Check if any filters are applied
    const hasActiveFilters = Object.values(filters).some(value => value !== '' && value !== null && value !== undefined);

    return (
        <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                    <h3 className="text-md font-semibold text-gray-700">กรองและค้นหา</h3>
                    <div className="flex items-center space-x-3">
                        {hasActiveFilters && (
                            <button
                                onClick={handleClearFilters}
                                className="text-sm text-gray-500 hover:text-gray-700 underline"
                            >
                                ล้างตัวกรอง
                            </button>
                        )}
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
                        >
                            {showAdvanced ? 'ซ่อน' : 'แสดง'}ตัวกรองขั้นสูง
                            <svg 
                                className={`ml-1 w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Quick Payment Method Filter */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">ประเภทการจ่าย</label>
                    <div className="flex flex-wrap gap-2">
                        <FilterBadge
                            label="ทั้งหมด"
                            isActive={filters.is_petty_cash_expense === ''}
                            onClick={() => handlePaymentMethodQuickSelect('')}
                            color="indigo"
                        />
                        <FilterBadge
                            label="💵 เงินสดย่อย"
                            isActive={filters.is_petty_cash_expense === 'true'}
                            onClick={() => handlePaymentMethodQuickSelect('true')}
                            color="green"
                        />
                        <FilterBadge
                            label="🏦 โอนธนาคาร"
                            isActive={filters.is_petty_cash_expense === 'false'}
                            onClick={() => handlePaymentMethodQuickSelect('false')}
                            color="blue"
                        />
                    </div>
                </div>

                {/* Quick Date Range Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">ช่วงวันที่</label>
                    <QuickDateSelector onSelect={handleQuickDateSelect} currentFilters={filters} />
                </div>

                {/* Advanced Filters */}
                {showAdvanced && (
                    <div className="space-y-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Custom Date Range */}
                            <div>
                                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                                    วันที่เริ่มต้น
                                </label>
                                <input
                                    type="date"
                                    name="startDate"
                                    id="startDate"
                                    value={filters.startDate}
                                    onChange={onFilterChange}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>

                            <div>
                                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                                    วันที่สิ้นสุด
                                </label>
                                <input
                                    type="date"
                                    name="endDate"
                                    id="endDate"
                                    value={filters.endDate}
                                    onChange={onFilterChange}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>

                            {/* Category Filter */}
                            <div>
                                <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">
                                    หมวดหมู่
                                </label>
                                <select
                                    name="category_id"
                                    id="category_id"
                                    value={filters.category_id}
                                    onChange={onFilterChange}
                                    className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                >
                                    <option value="">ทั้งหมด</option>
                                    {categories.map((category) => (
                                        <option key={category.category_id} value={category.category_id}>
                                            {category.category_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Payment Method Text Filter */}
                            <div>
                                <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700 mb-1">
                                    วิธีการชำระ
                                </label>
                                <input
                                    type="text"
                                    name="payment_method"
                                    id="payment_method"
                                    value={filters.payment_method}
                                    onChange={onFilterChange}
                                    placeholder="เช่น เงินสด, โอน, บัตรเครดิต"
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        {/* Category Quick Select */}
                        {categories && categories.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">หมวดหมู่ยอดนิยม</label>
                                <div className="flex flex-wrap gap-2">
                                    <FilterBadge
                                        label="ทั้งหมด"
                                        isActive={filters.category_id === ''}
                                        onClick={() => handleCategorySelect('')}
                                        color="indigo"
                                    />
                                    {categories.slice(0, 6).map((category) => (
                                        <FilterBadge
                                            key={category.category_id}
                                            label={category.category_name}
                                            isActive={filters.category_id === category.category_id.toString()}
                                            onClick={() => handleCategorySelect(category.category_id.toString())}
                                            color="indigo"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Apply Filter Button */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center text-sm text-gray-500">
                        {hasActiveFilters && (
                            <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                                </svg>
                                มีการกรองข้อมูล
                            </span>
                        )}
                    </div>
                    <div className="flex space-x-3">
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                ล้างตัวกรอง
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onApplyFilters}
                            disabled={isLoading || isFiltering}
                            className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isFiltering ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    กำลังกรอง...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    ค้นหา
                                </>
                            )}
                        </button>
                    </div>
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

                <EnhancedFilterSection
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
