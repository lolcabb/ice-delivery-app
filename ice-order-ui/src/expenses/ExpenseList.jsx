// Enhanced ExpenseList.jsx - Building on your existing structure
import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/currency';
import PaymentMethodBadge from '../components/PaymentMethodBadge';
import { useZoomPan } from '../hooks/useZoomPan';

const formatDate = (dateString) => {
    if (!dateString) return 'ไม่มีข้อมูล';
    return new Date(dateString).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

// Updated ReceiptModal component with fixed container styling
const ReceiptModal = ({ isOpen, onClose, imageUrl, expenseDescription }) => {
    const [imageState, setImageState] = useState({ loading: true, error: false });

    // Use the improved custom hook to manage zoom/pan interactions
    const { 
        containerRef, 
        imageRef, 
        imageStyle, 
        containerStyle,
        handleZoomIn, 
        handleZoomOut,
        handleReset,
        handleImageLoad: hookImageLoad,
        zoomLevel
    } = useZoomPan(isOpen);

    // Reset image state when the URL or modal visibility changes
    useEffect(() => {
        setImageState({ loading: true, error: false });
    }, [imageUrl, isOpen]);

    const handleImageLoad = (e) => {
        setImageState({ loading: false, error: false });
        hookImageLoad(e); // Call the hook's image load handler
    };
    
    const handleImageError = () => setImageState({ loading: false, error: true });

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    
    // Listen for Escape key to close the modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    // Early return if modal is not open (all hooks have been called)
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 overflow-hidden"
            onClick={handleOverlayClick}
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="flex items-center justify-center min-h-screen p-4">
                {/* Backdrop */}
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" aria-hidden="true"></div>

                {/* Modal Content */}
                <div className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                    {/* Header */}
                    <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex-1">
                            <h3 id="modal-title" className="text-lg leading-6 font-medium text-gray-900">
                                ใบเสร็จ/หลักฐาน
                            </h3>
                            {expenseDescription && (
                                <p className="mt-1 text-sm text-gray-600">{expenseDescription}</p>
                            )}
                        </div>
                        <button 
                            onClick={onClose} 
                            className="text-gray-400 hover:text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md p-1"
                        >
                            <span className="sr-only">Close</span>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Image Viewer - Updated with containerStyle */}
                    <div className="flex-1 relative bg-gray-50">
                        <div
                            ref={containerRef}
                            className="zoom-container w-full h-full flex items-center justify-center"
                            style={{ 
                                minHeight: '60vh',
                                ...containerStyle // Apply the containerStyle from the hook
                            }}
                        >
                            {imageState.loading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                                    <div className="text-gray-500">กำลังโหลดรูปภาพ...</div>
                                </div>
                            )}
                            
                            {imageState.error ? (
                                <div className="text-center text-red-500 p-4">
                                    <p>ไม่สามารถโหลดรูปภาพได้</p>
                                    <p className="text-xs text-gray-400 mt-1 truncate max-w-md mx-auto">URL: {imageUrl}</p>
                                </div>
                            ) : (
                                <img
                                    ref={imageRef}
                                    src={imageUrl}
                                    alt="ใบเสร็จ"
                                    className={`max-w-full max-h-full object-contain ${imageState.loading ? 'opacity-0' : 'opacity-100'}`}
                                    onLoad={handleImageLoad}
                                    onError={handleImageError}
                                    style={imageStyle}
                                    draggable={false}
                                />
                            )}

                            {/* Zoom Controls */}
                            {!imageState.error && !imageState.loading && (
                                <div className="absolute top-4 right-4 flex flex-col space-y-2">
                                    <div className="bg-white rounded-lg shadow-lg p-1">
                                        <button 
                                            onClick={handleZoomIn} 
                                            className="block w-10 h-10 text-gray-700 hover:bg-gray-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            title="Zoom In"
                                        >
                                            <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                                            </svg>
                                        </button>
                                        <button 
                                            onClick={handleZoomOut} 
                                            className="block w-10 h-10 text-gray-700 hover:bg-gray-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            title="Zoom Out"
                                        >
                                            <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM15 10H9" />
                                            </svg>
                                        </button>
                                        <button 
                                            onClick={handleReset} 
                                            className="block w-10 h-10 text-gray-700 hover:bg-gray-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            title="Reset"
                                        >
                                            <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="bg-white rounded-lg shadow-lg px-3 py-1 text-center">
                                        <span className="text-xs text-gray-600">{Math.round(zoomLevel * 100)}%</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                            ใช้ล้อเมาส์เพื่อซูม, ดับเบิลคลิกเพื่อซูมเข้า/ออก, ลากเพื่อเลื่อนดูภาพ
                        </div>
                        {!imageState.error && (
                            <a
                                href={imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm transition-colors"
                            >
                                เปิดในแท็บใหม่
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// === UPDATED RECEIPT ICON COMPONENT ===
const ReceiptIcon = ({ hasReceipt, onClick }) => {
    if (!hasReceipt) return null;

    return (
        <button
            onClick={onClick}
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 transition-colors duration-150"
            title="ดูใบเสร็จ"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        </button>
    );
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
const ActionButtons = ({ expense, onEdit, onDelete, onViewReceipt }) => {
    return (
        <div className="flex items-center space-x-2">
            {/* Receipt View Button */}
            {expense.related_document_url && (
                <ReceiptIcon
                    hasReceipt={true}
                    onClick={() => onViewReceipt(expense)}
                />
            )}
            {/* Edit Button */}
            <button
                onClick={() => onEdit(expense)}
                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
            >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                แก้ไข
            </button>
            {/* Delete Button */}
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
const PaginationControls = ({ pagination, onPageChange, disabled = false }) => {
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
                    onClick={() => onPageChange(1)}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    หน้าแรก
                </button>
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1 || disabled}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    ก่อนหน้า
                </button>
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages || disabled}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    ถัดไป
                </button>
                <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    สุดท้าย
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
                            onClick={() => onPageChange(1)}
                            disabled={page === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            หน้าแรก
                        </button>
                        <button
                            onClick={() => onPageChange(page - 1)}
                            disabled={page <= 1 || disabled}
                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="sr-only">ก่อนหน้า</span>
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </button>
                        
                        {getPageNumbers().map((pageNum) => (
                            <button
                                key={pageNum}
                                onClick={() => onPageChange(pageNum)}
                                disabled={disabled}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                    pageNum === page
                                        ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {pageNum}
                            </button>
                        ))}
                        
                        <button
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="sr-only">ต่อไป</span>
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <button
                            onClick={() => onPageChange(totalPages)}
                            disabled={page === totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            สุดท้าย
                        </button>
                    </nav>
                </div>
            </div>
        </div>
    );
};

// Main Enhanced Expense List Component
export default function ExpenseList({ expenses, onEdit, onDelete, isLoading, isFiltering = false,pagination, onPageChange }) {
    const hasFilters = pagination?.totalItems !== undefined;

    // === RECEIPT MODAL STATE ===
    const [receiptModal, setReceiptModal] = useState({
        isOpen: false,
        imageUrl: '',
        expenseDescription: ''
    });

    // === RECEIPT VIEWING HANDLER ===
    const handleViewReceipt = (expense) => {
        if (expense.related_document_url) {
            setReceiptModal({
                isOpen: true,
                imageUrl: expense.related_document_url,
                expenseDescription: expense.description
            });
        }
    };

    const closeReceiptModal = () => {
        setReceiptModal({
            isOpen: false,
            imageUrl: '',
            expenseDescription: ''
        });
    };

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
                                            {expense.reference_details ? 
                                                `${expense.reference_details.substring(0, 20)}${expense.reference_details.length > 20 ? '...' : ''}` 
                                                : '-'
                                            }
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <ActionButtons 
                                                expense={expense}
                                                onEdit={onEdit}
                                                onDelete={onDelete}
                                                onViewReceipt={handleViewReceipt}
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
                    disabled={isFiltering}
                />
            )}

            {/* === RECEIPT MODAL === */}
            <ReceiptModal
                isOpen={receiptModal.isOpen}
                onClose={closeReceiptModal}
                imageUrl={receiptModal.imageUrl}
                expenseDescription={receiptModal.expenseDescription}
            />
        </div>
    );
}
