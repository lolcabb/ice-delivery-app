// Suggested path: src/expenses/PettyCashLogManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../apiService'; // Adjust path as needed
import PettyCashLogList from './PettyCashLogList'; // Import the actual component
import PettyCashLogForm from './PettyCashLogForm'; // Import the actual component
// Modal is used by PettyCashLogForm, no direct import needed here.
import { formatDateForInput } from '../utils/dateUtils';
import { formatCurrency } from '../utils/currency';

// Simple Plus Icon
const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);


export default function PettyCashLogManager() {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false); // For reconcile or other specific actions
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [pagination, setPagination] = useState({ page: 1, limit: 15, totalPages: 1, totalItems: 0 });
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
    });

    // MODIFICATION 1: Changed signature and dependencies for useCallback
    // Removed default arguments that depend on component state from the function signature.
    // Dependencies now correctly reflect what's used from the outer scope inside the function body.
    const fetchPettyCashLogs = useCallback(async (pageToFetch, filtersToUse) => {
        setIsLoading(true);
        setError(null);
        try {
            // Use the passed pageToFetch and filtersToUse arguments
            const params = { ...filtersToUse, page: pageToFetch, limit: pagination.limit };
            Object.keys(params).forEach(key => {
                if (params[key] === '' || params[key] === null || params[key] === undefined) {
                    delete params[key];
                }
            });
            const response = await apiService.getPettyCashLogs(params);
            setLogs(Array.isArray(response.data) ? response.data : []);
            setPagination(response.pagination || { page: 1, limit: pagination.limit, totalPages: 1, totalItems: 0 });
        } catch (err) {
            console.error("Failed to fetch petty cash logs:", err);
            setError(err.data?.error || err.message || 'ไม่สามารถโหลดบันทึกเงินสดย่อยได้.');
            if (err.status === 401) {
                 apiService.handleComponentAuthError(err, () => window.location.replace('/login'));
            }
        } finally {
            setIsLoading(false);
        }
    }, [pagination.limit]); // pagination.limit is used from the outer scope

    // MODIFICATION 2: Removed the initial useEffect (around your line 56).
    // The useEffect below will handle the initial fetch because pagination.page starts at 1.
    // useEffect(() => {
    //     fetchPettyCashLogs(1, filters); // Initial fetch
    // }, []); // Runs once on mount

    // MODIFICATION 3: This useEffect will now also handle the initial data fetch.
    // Its dependencies are correct. When the component mounts,
    // pagination.page is 1 and filters are initial, triggering the first fetch.
    useEffect(() => {
        fetchPettyCashLogs(pagination.page, filters);
    }, [pagination.page, filters, fetchPettyCashLogs]); // fetchPettyCashLogs is stable if pagination.limit doesn't change


    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return; 
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const applyFilters = () => {
        // Set page to 1. The useEffect above will trigger a fetch with page 1 and current filters.
        setPagination(prev => ({ ...prev, page: 1 }));
        // Optionally, if you want an immediate fetch before the effect runs (e.g., if setPagination is batched):
        // fetchPettyCashLogs(1, filters); // This might be redundant if the useEffect handles it promptly.
                                       // For simplicity, let's rely on the useEffect.
    };

    const handleOpenModal = (logEntry = null) => {
        setEditingLog(logEntry);
        setIsModalOpen(true);
        setSuccessMessage('');
        setError(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingLog(null);
    };

    const handleSaveLog = async (logDataFromForm) => {
        let operationError = null;
        let successMsg = '';
        try {
            if (editingLog && editingLog.log_id) {
                const originalDateForURL = formatDateForInput(editingLog.log_date);
                await apiService.updatePettyCashLog(originalDateForURL, logDataFromForm);
                successMsg = `บันทึกเงินสดย่อยสำหรับวันที่ ${logDataFromForm.log_date || originalDateForURL} แก้ไขแล้ว.`;
            } else {
                await apiService.addPettyCashLog(logDataFromForm);
                successMsg = `เริ่มบันทึกเงินสดย่อยสำหรับวันที่ ${logDataFromForm.log_date} แล้ว.`;
            }
            setSuccessMessage(successMsg);
            handleCloseModal();
            // Fetch with current page if editing, or page 1 if adding new
            await fetchPettyCashLogs(editingLog ? pagination.page : 1, filters);
        } catch (err) {
            console.error("Error saving petty cash log:", err);
            operationError = err.data?.error || err.message || 'บันทึกเงินสดย่อยไม่สำเร็จ.';
            throw new Error(operationError);
        } finally {
            if (!operationError) {
                setTimeout(() => setSuccessMessage(''), 4000);
            }
        }
    };

    const handleReconcileLog = async (logDate) => {
        const confirmReconcile = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการกระทบยอดค่าใช้จ่ายสำหรับวันที่ ${logDate}? การดำเนินการนี้จะอัปเดตยอดรวมค่าใช้จ่ายสำหรับบันทึกนี้ตามค่าใช้จ่ายเงินสดย่อยที่บันทึกไว้สำหรับวันนั้น.`);
        if (!confirmReconcile) return;

        setIsSubmitting(true);
        setError(null);
        setSuccessMessage('');
        try {
            const dateForURL = formatDateForInput(logDate);
            const reconciledLogResponse = await apiService.reconcilePettyCashLog(dateForURL);
            const reconciledLog = reconciledLogResponse.log; // Assuming API returns { log: ... }
            setSuccessMessage(`กระทบยอดบันทึกเงินสดย่อยสำหรับวันที่ ${dateForURL} แล้ว ยอดรวมค่าใช้จ่าย: ${formatCurrency(reconciledLog.total_daily_petty_expenses)}`);
            setLogs(prevLogs => prevLogs.map(log => log.log_date === logDate ? reconciledLog : log));
        } catch (err)
{
            console.error("Failed to reconcile petty cash log:", err);
            setError(err.data?.error || err.message || `ไม่สามารถกระทบยอดบันทึกสำหรับ ${logDate} ได้.`);
            if (err.status === 401) {
                apiService.handleComponentAuthError(err, () => window.location.replace('/login'));
            }
        } finally {
            setIsSubmitting(false);
            setTimeout(() => setSuccessMessage(''), 5000);
        }
    };

    // Basic filter UI
    const FilterSection = () => (
        <div className="mb-6 p-4 bg-white shadow rounded-lg">
            <h3 className="text-md font-semibold text-gray-700 mb-3">กรองบันทึกเงินสดย่อย</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">วันที่เริ่มต้น</label>
                    <input type="date" name="startDate" id="startDate" value={filters.startDate} onChange={handleFilterChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                </div>
                <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">วันที่สิ้นสุด</label>
                    <input type="date" name="endDate" id="endDate" value={filters.endDate} onChange={handleFilterChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                </div>
                <div className="flex items-end">
                    <button
                        onClick={applyFilters}
                        disabled={isLoading || isSubmitting}
                        className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150 disabled:opacity-50"
                    >
                        {isLoading ? 'กำลังกรอง...' : 'ใช้ตัวกรอง'}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-[calc(100vh-theme(space.32))] rounded-lg shadow">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-3 border-b border-gray-300">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-0">
                        การจัดการบันทึกเงินสดย่อย
                    </h1>
                    <button
                        onClick={() => handleOpenModal(null)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors duration-150 flex items-center justify-center"
                    >
                        <PlusIcon />
                        เริ่มบันทึกเงินสดย่อยวันใหม่
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
                            onClick={() => fetchPettyCashLogs(pagination.page, filters)} // Ensure this call matches the new signature
                            className="ml-4 px-3 py-1 text-xs bg-red-200 hover:bg-red-300 rounded-md font-semibold"
                        >
                            ลองโหลดใหม่
                        </button>
                    </div>
                )}

                <FilterSection />

                <PettyCashLogList
                    logs={logs}
                    onEdit={handleOpenModal}
                    onReconcile={handleReconcileLog}
                    isLoading={isLoading || isSubmitting}
                    pagination={pagination}
                    onPageChange={handlePageChange}
                />

                <PettyCashLogForm
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveLog}
                    logEntry={editingLog}
                />
            </div>
        </div>
    );
}