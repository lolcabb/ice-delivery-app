// Enhanced ExpenseList.jsx - Building on your existing structure
import React from 'react';

// Enhanced formatting functions
const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(parseFloat(amount))) return '฿0.00';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 }).format(amount);
};

const formatDate = (dateString) => {
    if (!dateString) return 'ไม่มีข้อมูล';
    return new Date(dateString).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

// Payment Method Badge Component
const PaymentMethodBadge = ({ paymentMethod, isPettyCash }) => {
    if (isPettyCash) {
        return (
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                เงินสดย่อย
            </div>
        );
    } else {
        // Bank transfer or other methods
        return (
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                {paymentMethod || 'โอนธนาคาร'}
            </div>
        );
    }
};

// Amount Display Component with visual emphasis
const AmountDisplay = ({ amount, isPettyCash }) => {
    const textColor = isPettyCash ? 'text-green-700' : 'text-blue-700';
    const bgColor = isPettyCash ? 'bg-green-50' : 'bg-blue-50';
    
    return (
        <div className={`text-right px-3 py-1 rounded-lg ${bgColor}`}>
            <span className={`text-sm font-semibold ${textColor}`}>
                {formatCurrency(amount)}
            </span>
        </div>
    );
};

// Category Badge Component
const CategoryBadge = ({ categoryName }) => {
    return (
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
            {categoryName || 'ไม่มีหมวดหมู่'}
        </span>
    );
};

// Action Buttons Component
const ActionButtons = ({ expense, onEdit, onDelete }) => {
    return (
        <div className="flex items-center space-x-2">
            <button
                onClick={() => onEdit(expense)}
                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
            >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                แก้ไข
            </button>
            <button
                onClick={() => onDelete(expense.expense_id)}
                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-150"
            >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                ลบ
            </button>
        </div>
    );
};

// Loading Row Component
const LoadingRow = () => {
    return (
        <tr className="animate-pulse">
            {[...Array(7)].map((_, index) => (
                <td key={index} className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 bg-gray-200 rounded"></div>
                </td>
            ))}
        </tr>
    );
};

// Empty State Component
const EmptyState = ({ isFiltered }) => {
    return (
        <tr>
            <td colSpan="7" className="px-6 py-12 text-center">
                <div className="flex flex-col items-center">
                    <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h2m0-13v13m0-13h2a2 2 0 012 2v11a2 2 0 01-2 2h-2m-6-9h6m-6 4h6" />
                    </svg>
                    <p className="text-gray-500 text-sm">
                        {isFiltered 
                            ? 'ไม่พบรายการค่าใช้จ่ายที่ตรงกับเงื่อนไขการค้นหา' 
                            : 'ยังไม่มีรายการค่าใช้จ่าย'
                        }
                    </p>
                    {isFiltered && (
                        <p className="text-gray-400 text-xs mt-1">
                            ลองปรับเงื่อนไขการค้นหาใหม่
                        </p>
                    )}
                </div>
            </td>
        </tr>
    );
};

// Pagination Component
const PaginationControls = ({ pagination, onPageChange }) => {
    const { page, totalPages, totalItems } = pagination;
    
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages = [];
        const showPages = 5; // Show 5 page numbers
        let start = Math.max(1, page - Math.floor(showPages / 2));
        let end = Math.min(totalPages, start + showPages - 1);
        
        if (end - start + 1 < showPages) {
            start = Math.max(1, end - showPages + 1);
        }
        
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    return (
        <div className="bg-white px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    ก่อนหน้า
                </button>
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    ถัดไป
                </button>
            </div>
            
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-700">
                        แสดง <span className="font-medium">{((page - 1) * 20) + 1}</span> ถึง{' '}
                        <span className="font-medium">{Math.min(page * 20, totalItems)}</span> จาก{' '}
                        <span className="font-medium">{totalItems}</span> รายการ
                    </p>
                </div>
                <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                            onClick={() => onPageChange(page - 1)}
                            disabled={page <= 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="sr-only">Previous</span>
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </button>
                        
                        {getPageNumbers().map((pageNum) => (
                            <button
                                key={pageNum}
                                onClick={() => onPageChange(pageNum)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                    pageNum === page
                                        ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                                {pageNum}
                            </button>
                        ))}
                        
                        <button
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="sr-only">Next</span>
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </nav>
                </div>
            </div>
        </div>
    );
};

// Main Enhanced Expense List Component
export default function ExpenseList({ expenses, onEdit, onDelete, isLoading, pagination, onPageChange }) {
    const hasFilters = pagination?.totalItems !== undefined;

    return (
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            {/* Header with summary */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">รายการค่าใช้จ่าย</h3>
                    {pagination?.totalItems !== undefined && (
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center">
                                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                                <span>เงินสดย่อย</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                                <span>โอนธนาคาร</span>
                            </div>
                            <span className="text-gray-400">|</span>
                            <span>รวม {pagination.totalItems} รายการ</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                วันที่
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                หมวดหมู่
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                รายละเอียด
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                จำนวนเงิน
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                ประเภทการจ่าย
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                อ้างอิง
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                การดำเนินการ
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            // Show loading rows
                            [...Array(5)].map((_, index) => <LoadingRow key={index} />)
                        ) : expenses.length === 0 ? (
                            // Show empty state
                            <EmptyState isFiltered={hasFilters} />
                        ) : (
                            // Show actual expense data
                            expenses.map((expense) => (
                                <tr 
                                    key={expense.expense_id} 
                                    className={`hover:bg-gray-50 transition-colors duration-150 ${
                                        expense.is_petty_cash_expense ? 'border-l-4 border-green-300' : 'border-l-4 border-blue-300'
                                    }`}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                        {formatDate(expense.expense_date)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <CategoryBadge categoryName={expense.category_name} />
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs xl:max-w-sm">
                                        <div className="break-words">
                                            <span className="font-medium">{expense.description}</span>
                                            {expense.reference_details && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {expense.reference_details}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <AmountDisplay 
                                            amount={expense.amount} 
                                            isPettyCash={expense.is_petty_cash_expense} 
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <PaymentMethodBadge 
                                            paymentMethod={expense.payment_method}
                                            isPettyCash={expense.is_petty_cash_expense}
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {expense.reference_details ? (
                                            <span className="truncate max-w-24 block" title={expense.reference_details}>
                                                {expense.reference_details}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 italic">ไม่มี</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <ActionButtons 
                                            expense={expense}
                                            onEdit={onEdit}
                                            onDelete={onDelete}
                                        />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && !isLoading && (
                <PaginationControls 
                    pagination={pagination} 
                    onPageChange={onPageChange} 
                />
            )}
        </div>
    );
}