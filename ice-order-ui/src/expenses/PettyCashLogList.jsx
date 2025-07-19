// Suggested path: src/expenses/PettyCashLogList.jsx
import React from 'react';
import { formatCurrency } from '../utils/currency';

// --- Icon Components (can be moved to a shared icons file) ---
const EditIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
);

const ReconcileIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a9.006 9.006 0 00-5.21-5.21C12.755 3.046 11.532 3 10.299 3A9.006 9.006 0 005.09 8.138C5.046 9.245 5 10.468 5 11.7c0 1.232.046 2.453.138 3.662a9.006 9.006 0 005.21 5.21c1.233.092 2.456.138 3.69.138 1.232 0 2.453-.046 3.662-.138a9.006 9.006 0 005.21-5.21c.092-1.233.138-2.456.138-3.69z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5V21m0-18v1.5m6.75 3.75l-1.06-1.06M5.25 17.25L4.19 18.31m13.06-13.06l-1.06 1.06M5.25 6.75L4.19 5.69m14.5 0h-1.5m-15 0H3m1.5 15H3m1.5-15V3m0 15v1.5" />
    </svg>
);


const ChevronLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
);

const ChevronRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
);
// --- End Icon Components ---

// Helper to format date
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString.split('T')[0] + 'T00:00:00'); // Treat as local date
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD, or choose preferred locale
};


const PettyCashLogList = ({
    logs,
    onEdit,
    onReconcile,
    isLoading,
    pagination, // { page, limit, totalItems, totalPages }
    onPageChange,
}) => {
    if (isLoading && (!logs || logs.length === 0)) {
        return (
            <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">กำลังโหลดบันทึกเงินสดย่อย...</p>
            </div>
        );
    }

    if (!isLoading && (!logs || logs.length === 0)) {
        return (
            <div className="bg-white shadow rounded-lg p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">ไม่มีบันทึกเงินสดย่อย</h3>
                <p className="mt-1 text-sm text-gray-500">
                    เริ่มบันทึกวันใหม่เพื่อติดตามเงินสดย่อย
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white shadow border-b border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่</th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ยอดยกมา (฿)</th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">เงินสดเข้า (฿)</th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ค่าใช้จ่าย (฿)</th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ยอดคงเหลือ (฿)</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการโดย</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมายเหตุ</th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">การดำเนินการ</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {logs.map((log) => (
                            <tr key={log.log_id} className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">{formatDate(log.log_date)}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{formatCurrency(log.opening_balance)}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600 text-right">{formatCurrency(log.cash_received_amount)}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600 text-right">{formatCurrency(log.total_daily_petty_expenses)}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold text-right">{formatCurrency(log.closing_balance)}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{log.user_managed_by || 'ไม่มีข้อมูล'}</td>
                                <td className="px-4 py-4 text-sm text-gray-500 max-w-xs truncate" title={log.notes}>
                                    {log.notes || <span className="italic text-gray-400">ไม่มีหมายเหตุ</span>}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button
                                        onClick={() => onEdit(log)}
                                        className="text-indigo-600 hover:text-indigo-800 transition-colors p-1 rounded hover:bg-indigo-50"
                                        title="ดู/แก้ไขรายละเอียดบันทึก"
                                    >
                                        <EditIcon />
                                    </button>
                                    <button
                                        onClick={() => onReconcile(log.log_date)}
                                        className="text-teal-600 hover:text-teal-800 transition-colors p-1 rounded hover:bg-teal-50"
                                        title="กระทบยอดค่าใช้จ่ายสำหรับวันนี้"
                                    >
                                        <ReconcileIcon />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
                <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 bg-white rounded-b-lg">
                    <div className="flex-1 flex justify-between sm:hidden">
                        <button
                            onClick={() => onPageChange(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            ก่อนหน้า
                        </button>
                        <button
                            onClick={() => onPageChange(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            ถัดไป
                        </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700">
                                แสดง <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span>
                                {' '}ถึง <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.totalItems)}</span>
                                {' '}จากทั้งหมด <span className="font-medium">{pagination.totalItems}</span> รายการ
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => onPageChange(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    title="Previous"
                                >
                                    <span className="sr-only">ก่อนหน้า</span>
                                    <ChevronLeftIcon />
                                </button>
                                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                    หน้า {pagination.page} จาก {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => onPageChange(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.totalPages}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    title="Next"
                                >
                                    <span className="sr-only">ถัดไป</span>
                                    <ChevronRightIcon />
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            )}
            {isLoading && logs && logs.length > 0 && (
                <div className="py-4 text-center text-sm text-gray-500">กำลังอัปเดตรายการ...</div>
            )}
        </div>
    );
};

export default PettyCashLogList;
