// Suggested path: src/expenses/ExpenseReports.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../apiService'; // Adjust path if needed

// Helper to format date
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString.split('T')[0] + 'T00:00:00');
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD, or choose preferred locale
};

// Helper to format currency (Thai Baht)
const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(parseFloat(amount))) return 'N/A';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 }).format(amount);
};

// --- Icon for Download (Placeholder) ---
const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);


export default function ExpenseReports() {
    const [reportData, setReportData] = useState([]);
    const [reportSummary, setReportSummary] = useState(null);
    const [categories, setCategories] = useState([]);
    const [users, setUsers] = useState([]); // For filtering by user who recorded

    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        category_id: '',
        payment_method: '',
        is_petty_cash_expense: '', // 'true', 'false', or ''
        user_id: '', // User who recorded the expense
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasGeneratedReport, setHasGeneratedReport] = useState(false);


    const fetchCategories = useCallback(async () => {
        try {
            const data = await apiService.getExpenseCategories();
            setCategories(Array.isArray(data) ? data.filter(cat => cat.is_active) : []);
        } catch (err) {
            console.error("Failed to fetch categories for report filters:", err);
            // Non-critical error, form can still function
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        // Assuming you have an API endpoint to fetch users (e.g., for a dropdown)
        // For now, this is a placeholder. Replace with your actual API call if available.
        // try {
        //     const userData = await apiService.getUsers(); // Example: you'd need to create this in apiService
        //     setUsers(Array.isArray(userData) ? userData : []);
        // } catch (err) {
        //     console.error("Failed to fetch users for report filters:", err);
        // }
        console.warn("User fetching for report filters is not implemented yet.");
        setUsers([]); // Placeholder
    }, []);


    useEffect(() => {
        fetchCategories();
        fetchUsers(); // Fetch users for filter dropdown
    }, [fetchCategories, fetchUsers]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateReport = async () => {
        setIsLoading(true);
        setError(null);
        setHasGeneratedReport(true);
        try {
            const activeFilters = { ...filters };
            // Remove empty filter values so they are not sent as empty strings
            Object.keys(activeFilters).forEach(key => {
                if (activeFilters[key] === '' || activeFilters[key] === null || activeFilters[key] === undefined) {
                    delete activeFilters[key];
                }
            });
            const response = await apiService.getDetailedExpenseReport(activeFilters);
            setReportData(Array.isArray(response.reportData) ? response.reportData : []);
            setReportSummary(response.summary || null);
        } catch (err) {
            console.error("Failed to generate report:", err);
            setError(err.data?.error || err.message || 'ไม่สามารถสร้างรายงานได้.');
            setReportData([]);
            setReportSummary(null);
            if (err.status === 401) {
                apiService.handleComponentAuthError(err, () => window.location.replace('/login'));
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    // Basic CSV export functionality (can be enhanced)
    const exportToCSV = () => {
        if (!reportData || reportData.length === 0) {
            alert("No data to export.");
            return;
        }
        const headers = ["วันที่", "หมวดหมู่", "รายละเอียด", "จำนวนเงิน (บาท)", "วิธีการชำระเงิน", "อ้างอิง", "เงินสดย่อย", "บันทึกโดย", "บันทึกเมื่อ"];
        const rows = reportData.map(row => [
            formatDate(row.expense_date),
            row.category_name,
            `"${(row.description || '').replace(/"/g, '""')}"`, // Handle quotes and ensure string
            row.amount,
            row.payment_method || '',
            `"${(row.reference_details || '').replace(/"/g, '""')}"`, // Handle quotes and ensure string
            row.is_petty_cash_expense ? 'ใช่' : 'ไม่',
            row.recorded_by || '',
            row.recorded_at ? new Date(row.recorded_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '' // Use Thai locale for date
        ]);

        // Add UTF-8 BOM
        const BOM = "\\uFEFF";
        let csvContent = BOM + headers.join(",") + "\\n" 
            + rows.map(e => e.join(",")).join("\\n");

        // Create a Blob with UTF-8 encoding specified
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        
        const link = document.createElement("a");
        if (link.download !== undefined) { // Feature detection
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `expense_report_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            // Fallback for older browsers (though less common now)
            const encodedUri = encodeURI("data:text/csv;charset=utf-8," + BOM + csvContent);
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `expense_report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link); 
            link.click();
            document.body.removeChild(link);
        }
    };


    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen rounded-lg shadow">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-300">
                    รายงานค่าใช้จ่าย
                </h1>

                {/* Filter Section */}
                <div className="mb-8 p-4 sm:p-6 bg-white shadow rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">ตัวกรองรายงาน</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">วันที่เริ่มต้น</label>
                            <input type="date" name="startDate" id="startDate" value={filters.startDate} onChange={handleFilterChange} className="mt-1 input-field"/>
                        </div>
                        <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">วันที่สิ้นสุด</label>
                            <input type="date" name="endDate" id="endDate" value={filters.endDate} onChange={handleFilterChange} className="mt-1 input-field"/>
                        </div>
                        <div>
                            <label htmlFor="category_id" className="block text-sm font-medium text-gray-700">หมวดหมู่</label>
                            <select name="category_id" id="category_id" value={filters.category_id} onChange={handleFilterChange} className="mt-1 input-field">
                                <option value="">ทุกหมวดหมู่</option>
                                {categories.map(cat => <option key={cat.category_id} value={cat.category_id}>{cat.category_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700">วิธีการชำระเงิน</label>
                            <input type="text" name="payment_method" id="payment_method" value={filters.payment_method} onChange={handleFilterChange} placeholder="เช่น เงินสด, ธนาคาร" className="mt-1 input-field"/>
                        </div>
                        <div>
                            <label htmlFor="is_petty_cash_expense" className="block text-sm font-medium text-gray-700">เงินสดย่อย</label>
                            <select name="is_petty_cash_expense" id="is_petty_cash_expense" value={filters.is_petty_cash_expense} onChange={handleFilterChange} className="mt-1 input-field">
                                <option value="">ทั้งหมด</option>
                                <option value="true">ใช่</option>
                                <option value="false">ไม่</option>
                            </select>
                        </div>
                        {/* Optional: Filter by user who recorded - Implement if needed and users are fetched */}
                        {/* <div>
                            <label htmlFor="user_id" className="block text-sm font-medium text-gray-700">Recorded By</label>
                            <select name="user_id" id="user_id" value={filters.user_id} onChange={handleFilterChange} className="mt-1 input-field">
                                <option value="">All Users</option>
                                {users.map(user => <option key={user.id} value={user.id}>{user.username}</option>)}
                            </select>
                        </div> */}
                    </div>
                    <div className="mt-6">
                        <button
                            onClick={handleGenerateReport}
                            disabled={isLoading}
                            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150 disabled:opacity-50 flex items-center justify-center"
                        >
                            {isLoading ? 'กำลังสร้างรายงาน...' : 'สร้างรายงาน'}
                        </button>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm shadow">
                        <strong>ข้อผิดพลาด:</strong> {error}
                    </div>
                )}

                {/* Report Results Section */}
                {hasGeneratedReport && !isLoading && !error && (
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-center border-b border-gray-200">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-800">ผลลัพธ์รายงาน</h3>
                                {reportSummary && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        จำนวนรายการทั้งหมด: {reportSummary.numberOfEntries} | ยอดรวมสุทธิ: <span className="font-bold">{formatCurrency(reportSummary.grandTotal)}</span>
                                    </p>
                                )}
                            </div>
                            {reportData.length > 0 && (
                                <button
                                    onClick={exportToCSV}
                                    className="mt-3 sm:mt-0 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150 flex items-center"
                                >
                                   <DownloadIcon /> ส่งออกเป็น CSV
                                </button>
                            )}
                        </div>
                        
                        {reportData.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 th-cell">วันที่</th>
                                            <th className="px-4 py-3 th-cell">หมวดหมู่</th>
                                            <th className="px-4 py-3 th-cell">รายละเอียด</th>
                                            <th className="px-4 py-3 th-cell text-right">จำนวนเงิน (บาท)</th>
                                            <th className="px-4 py-3 th-cell">วิธีการชำระเงิน</th>
                                            <th className="px-4 py-3 th-cell">เงินสดย่อย</th>
                                            <th className="px-4 py-3 th-cell">บันทึกโดย</th>
                                            <th className="px-4 py-3 th-cell">อ้างอิง</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {reportData.map((item) => (
                                            <tr key={item.expense_id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 td-cell">{formatDate(item.expense_date)}</td>
                                                <td className="px-4 py-3 td-cell">{item.category_name}</td>
                                                <td className="px-4 py-3 td-cell max-w-xs break-words">{item.description}</td>
                                                <td className="px-4 py-3 td-cell text-right font-medium">{formatCurrency(item.amount)}</td>
                                                <td className="px-4 py-3 td-cell">{item.payment_method || '-'}</td>
                                                <td className="px-4 py-3 td-cell text-center">{item.is_petty_cash_expense ? 'ใช่' : 'ไม่'}</td>
                                                <td className="px-4 py-3 td-cell">{item.recorded_by || '-'}</td>
                                                <td className="px-4 py-3 td-cell max-w-xs break-words">{item.reference_details || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="p-6 text-center text-gray-500">ไม่พบข้อมูลสำหรับตัวกรองที่เลือก.</p>
                        )}
                    </div>
                )}
                 {isLoading && <div className="text-center py-8"><p className="text-gray-500">กำลังสร้างรายงาน...</p></div>}
            </div>
            {/* Basic styles for table cells and inputs, assuming Tailwind is set up */}
            <style jsx global>{`
                .input-field {
                    display: block;
                    width: 100%;
                    padding-left: 0.75rem; padding-right: 0.75rem;
                    padding-top: 0.5rem; padding-bottom: 0.5rem;
                    border-width: 1px; border-color: #D1D5DB; /* border-gray-300 */
                    border-radius: 0.375rem; /* rounded-md */
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
                }
                .input-field:focus {
                    outline: 2px solid transparent; outline-offset: 2px;
                    border-color: #6366F1; /* focus:border-indigo-500 */
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5); /* focus:ring-indigo-500 with opacity */
                }
                .th-cell { text-align: left; font-size: 0.75rem; font-weight: 500; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; }
                .td-cell { white-space: nowrap; font-size: 0.875rem; color: #374151; }
                .td-cell.max-w-xs { max-width: 20rem; } /* For description/reference */
                .td-cell.break-words { white-space: normal; }
            `}</style>
        </div>
    );
}

