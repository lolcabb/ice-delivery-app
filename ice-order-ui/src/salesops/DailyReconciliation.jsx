import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../apiService';
import { getCurrentLocalDateISO } from '../utils/dateUtils';
import { CheckCircleIcon, CurrencyDollarIcon, DocumentChartBarIcon, ExclamationTriangleIcon, PencilSquareIcon, TableCellsIcon } from '../components/Icons'; // Added new icons

// Helper to format currency
const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(parseFloat(amount))) return '฿0.00';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
};

// --- NEW: Simplified Sales List Component ---
const SalesList = ({ sales = [] }) => {
    if (sales.length === 0) {
        return <p className="text-center text-sm text-gray-500 py-4">ไม่มีการบันทึกการขายสำหรับวันนี้</p>;
    }

    return (
        <div className="space-y-2">
            {sales.map(sale => (
                <div key={sale.sale_id} className="text-xs border-b border-gray-200 last:border-b-0 py-2">
                    <div className="flex justify-between items-start">
                        <p className="font-semibold text-gray-700">{sale.customer_name_override || sale.actual_customer_name}</p>
                        <p className="font-bold text-gray-800">{formatCurrency(sale.total_sale_amount)}</p>
                    </div>
                    <ul className="pl-2 mt-1 text-gray-600">
                        {sale.sale_items.map(item => (
                            <li key={item.item_id} className="flex justify-between">
                                <span>{item.product_name} x{item.quantity_sold} @{formatCurrency(item.unit_price)}</span>
                                <span>{formatCurrency(item.quantity_sold * item.unit_price)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
};

// Status Badge Component (No changes)
const StatusBadge = ({ status }) => {
    const statusStyles = {
        'กระทบยอดแล้ว': 'bg-green-100 text-green-800',
        'เงินสดขาด': 'bg-yellow-100 text-yellow-800',
        'เงินสดเกิน': 'bg-blue-100 text-blue-800',
        'รอการปรับปรุง': 'bg-orange-100 text-orange-800',
        'รอดำเนินการ': 'bg-gray-100 text-gray-800',
    };
    const style = statusStyles[status] || statusStyles['รอดำเนินการ'];
    return (
        <span className={`px-3 py-1 text-xs font-medium rounded-full inline-flex items-center ${style}`}>
            {status}
        </span>
    );
};


// Main Component
export default function DailyReconciliation() {
    // State for filters and data
    const [drivers, setDrivers] = useState([]);
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const [selectedDate, setSelectedDate] = useState(getCurrentLocalDateISO());
    const [summary, setSummary] = useState(null);
    const [productReconciliation, setProductReconciliation] = useState([]);
    const [dailySales, setDailySales] = useState([]); // <-- NEW: State for the sales list
    
    // State for the reconciliation form inputs
    const [cashCollected, setCashCollected] = useState('');
    const [reconciliationStatus, setReconciliationStatus] = useState('รอดำเนินการ');
    const [reconciliationNotes, setReconciliationNotes] = useState('');

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); 
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [isFormUnlocked, setIsFormUnlocked] = useState(false); // <-- NEW: State for unlock override

    // Memoize user role to prevent re-parsing on every render
    const currentUserRole = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('authUser'))?.role?.toLowerCase();
        } catch {
            return null;
        }
    }, []);

    // Fetch active drivers for the dropdown
    useEffect(() => {
        const fetchDrivers = async () => {
            try {
                const driversData = await apiService.getDrivers({ is_active: true });
                setDrivers(Array.isArray(driversData) ? driversData : []);
            } catch (err) {
                setError("Could not load drivers list.");
            }
        };
        fetchDrivers();
    }, []);
    
    // Clear data when filters change
    useEffect(() => {
        setSummary(null);
        setProductReconciliation([]);
        setDailySales([]); // <-- Clear sales list on filter change
        setIsFormUnlocked(false); // <-- Reset unlock state
        setError(null);
        setSuccessMessage('');
    }, [selectedDriverId, selectedDate]);


    const handleFetchReconciliationData = useCallback(async () => {
        if (!selectedDriverId || !selectedDate) {
            setError("กรุณาเลือกพนักงานขับรถและวันที่เพื่อสร้างสรุป");
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuccessMessage('');
        setIsFormUnlocked(false); // <-- Reset unlock on fetch
        try {
            const data = await apiService.getReconciliationSummary(selectedDriverId, selectedDate);
            setSummary(data.summary || null);
            setProductReconciliation(data.product_reconciliation || []);
            
            // --- NEW: Fetch sales data if summary exists ---
            if (data.summary && data.summary.summary_id) {
                const salesData = await apiService.getDriverSales(data.summary.summary_id);
                setDailySales(Array.isArray(salesData) ? salesData : []);
            } else {
                 setDailySales([]);
            }

            // Pre-fill form based on fetched summary
            if(data.summary) {
                setCashCollected(data.summary.total_cash_collected_from_driver || '');
                setReconciliationStatus(data.summary.reconciliation_status || 'Pending');
                setReconciliationNotes(data.summary.reconciliation_notes || '');
            } else {
                setError("ไม่พบสรุปยอดขายสำหรับพนักงานขับรถคนนี้ในวันที่นี้ กรุณาตรวจสอบว่ามีการบันทึกการขายหรือคืนสินค้าเพื่อเริ่มต้นวัน");
            }

        } catch (err) {
            setError(err.data?.error || err.message || "ไม่สามารถดึงข้อมูลการกระทบยอดได้");
            setSummary(null);
            setProductReconciliation([]);
            setDailySales([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDriverId, selectedDate]);

    const handleFinalizeReconciliation = async (e) => {
        e.preventDefault();
        if(!summary || !summary.summary_id) {
            setError("ไม่มีสรุปเพื่อกระทบยอด");
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setSuccessMessage('');
        try {
            const payload = {
                total_cash_collected_from_driver: parseFloat(cashCollected) || 0,
                reconciliation_status: reconciliationStatus,
                reconciliation_notes: reconciliationNotes,
            };
            const updatedSummary = await apiService.reconcileDriverDailySummary(summary.summary_id, payload);
            
            setSummary(updatedSummary);
            setCashCollected(updatedSummary.total_cash_collected_from_driver || '');
            setReconciliationStatus(updatedSummary.reconciliation_status || 'Pending');
            setReconciliationNotes(updatedSummary.reconciliation_notes || '');
            setIsFormUnlocked(false); // <-- Re-lock form after saving

            setSuccessMessage("การกระทบยอดบันทึกสำเร็จ!");

        } catch (err) {
            setError(err.data?.error || err.message || "บันทึกการกระทบยอดไม่สำเร็จ");
        } finally {
            setIsSubmitting(false); 
        }
    };
    
    const expectedCash = summary?.total_cash_sales_value || 0;
    const cashDifference = (parseFloat(cashCollected) || 0) - expectedCash;
    const isReconciled = summary?.reconciliation_status && summary.reconciliation_status !== 'Pending';
    const canUnlock = isReconciled && (currentUserRole === 'admin' || currentUserRole === 'manager');


    return (
        <div className="p-0 sm:p-2 lg:p-4">
            <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
                <div className="border-b border-gray-200 pb-4 mb-6">
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-700">กระทบยอดรายวัน</h2>
                    <p className="text-sm text-gray-500 mt-1">ตรวจสอบยอดขาย, ยอดคืนสินค้า และเงินสดที่เก็บได้ของพนักงานขับรถแต่ละคน</p>
                </div>

                {/* Filter Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                    <div>
                        <label htmlFor="driver-select" className="block text-sm font-medium text-gray-700">พนักงานขับรถ</label>
                        <select id="driver-select" value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)} className="mt-1 block w-full input-field">
                            <option value="">-- เลือกพนักงานขับรถ --</option>
                            {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="date-select" className="block text-sm font-medium text-gray-700">วันที่</label>
                        <input type="date" id="date-select" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="mt-1 block w-full input-field"/>
                    </div>
                    <button onClick={handleFetchReconciliationData} disabled={!selectedDriverId || !selectedDate || isLoading} className="btn-primary w-full md:w-auto">
                        {isLoading ? 'กำลังโหลด...' : 'สร้างสรุป'}
                    </button>
                </div>
                
                {error && <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-md text-sm">{error}</div>}
                {successMessage && <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-200 rounded-md text-sm">{successMessage}</div>}


                {summary && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Side: Data Display */}
                    <div className="space-y-6">
                        {/* Financial Summary */}
                        <div>
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-gray-800 flex items-center"><CurrencyDollarIcon className="w-6 h-6 mr-2 text-green-500"/>สรุปการเงิน</h3>
                                <StatusBadge status={summary.reconciliation_status} />
                            </div>
                            <div className="mt-2 bg-gray-50 p-4 rounded-lg border">
                                <dl className="space-y-2 text-sm">
                                    <div className="flex justify-between"><dt className="text-gray-600">ยอดขายเงินสดที่คาดหวัง:</dt><dd className="font-mono text-gray-900">{formatCurrency(summary.total_cash_sales_value)}</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-600">ยอดขายเครดิตใหม่:</dt><dd className="font-mono text-gray-900">{formatCurrency(summary.total_new_credit_sales_value)}</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-600">การชำระเงินอื่นๆ:</dt><dd className="font-mono text-gray-900">{formatCurrency(summary.total_other_payment_sales_value)}</dd></div>
                                </dl>
                            </div>
                        </div>

                        {/* Product Reconciliation */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 flex items-center"><DocumentChartBarIcon className="w-6 h-6 mr-2 text-blue-500"/>กระทบยอดสินค้า</h3>
                            <div className="mt-2 overflow-x-auto border rounded-lg">
                                <table className="min-w-full">
                                    <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                                        <tr>
                                            <th className="py-2 px-3 text-left">สินค้า</th>
                                            <th className="py-2 px-3 text-right">นำขึ้น</th>
                                            <th className="py-2 px-3 text-right">ขายแล้ว</th>
                                            <th className="py-2 px-3 text-right">คืนแล้ว</th>
                                            <th className="py-2 px-3 text-right font-bold">ขาดดุล</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm divide-y">
                                        {productReconciliation.map(p => (
                                            <tr key={p.product_id} className="hover:bg-gray-50">
                                                <td className="py-2 px-3 font-medium text-gray-800">{p.product_name}</td>
                                                <td className="py-2 px-3 text-right font-mono">{p.loaded}</td>
                                                <td className="py-2 px-3 text-right font-mono text-green-600">{p.sold}</td>
                                                <td className="py-2 px-3 text-right font-mono text-blue-600">{p.returned}</td>
                                                <td className={`py-2 px-3 text-right font-mono font-bold ${p.loss !== 0 ? 'text-red-600' : 'text-gray-700'}`}>{p.loss}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                         {/* --- NEW: Simplified Sales List --- */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 flex items-center"><TableCellsIcon className="w-6 h-6 mr-2 text-purple-500"/>รายละเอียดการขาย</h3>
                            <div className="mt-2 border rounded-lg max-h-60 overflow-y-auto p-2 bg-gray-50/50">
                                <SalesList sales={dailySales} />
                            </div>
                        </div>

                    </div>

                    {/* Right Side: Reconciliation Form */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-800 flex items-center"><CheckCircleIcon className="w-6 h-6 mr-2 text-indigo-500"/>ยืนยันการกระทบยอด</h3>
                             {/* --- NEW: Unlock Button --- */}
                            {canUnlock && !isFormUnlocked && (
                                <button onClick={() => setIsFormUnlocked(true)} className="flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded-md">
                                    <PencilSquareIcon className="w-4 h-4 mr-1"/> ปลดล็อกเพื่อแก้ไข
                                </button>
                            )}
                        </div>
                        <fieldset disabled={isReconciled && !isFormUnlocked}>
                            <form onSubmit={handleFinalizeReconciliation} className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm space-y-4">
                                <div>
                                    <label htmlFor="cash-collected" className="block text-sm font-medium text-gray-700">เงินสดที่เก็บได้จริง</label>
                                    <input type="number" id="cash-collected" value={cashCollected} onChange={(e) => setCashCollected(e.target.value)} step="0.01" className="mt-1 w-full input-field" placeholder="0.00" required/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">ส่วนต่างเงินสด</label>
                                    <div className={`mt-1 p-2 rounded-md text-center font-bold text-lg ${cashDifference === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {formatCurrency(cashDifference)}
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="reconciliation-status" className="block text-sm font-medium text-gray-700">สถานะการกระทบยอด</label>
                                    <select id="reconciliation-status" value={reconciliationStatus} onChange={(e) => setReconciliationStatus(e.target.value)} className="mt-1 w-full input-field" required>
                                        <option value="Pending">รอดำเนินการ</option>
                                        <option value="Reconciled">กระทบยอดแล้ว</option>
                                        <option value="Cash Short">เงินสดขาด</option>
                                        <option value="Cash Over">เงินสดเกิน</option>
                                        <option value="Pending Adjustment">รอการปรับปรุง</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="reconciliation-notes" className="block text-sm font-medium text-gray-700">หมายเหตุ</label>
                                    <textarea id="reconciliation-notes" value={reconciliationNotes} onChange={(e) => setReconciliationNotes(e.target.value)} rows="3" className="mt-1 w-full input-field" placeholder="เพิ่มหมายเหตุเกี่ยวกับการกระทบยอด..."></textarea>
                                </div>
                                <button type="submit" disabled={isSubmitting || (isReconciled && !isFormUnlocked)} className="w-full btn-primary bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400">
                                    {isSubmitting ? 'กำลังบันทึก...' : (isReconciled && !isFormUnlocked ? 'กระทบยอดวันแล้ว' : 'ยืนยันและสรุป')}
                                </button>
                            </form>
                        </fieldset>
                    </div>
                </div>
                )}
            </div>
             <style jsx global>{`
                .input-field { display: block; width: 100%; padding-left: 0.75rem; padding-right: 0.75rem; padding-top: 0.5rem; padding-bottom: 0.5rem; border-width: 1px; border-color: #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
                select.input-field { -webkit-appearance: none; -moz-appearance: none; appearance: none; background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e"); background-position: right 0.5rem center; background-repeat: no-repeat; background-size: 1.5em 1.5em; padding-right: 2.5rem; }
                .input-field:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.3); }
                .input-field:disabled { background-color: #f3f4f6; cursor: not-allowed; }
                .btn-primary { background-color: #4f46e5; color: white; padding: 0.625rem 1rem; font-weight: 500; font-size: 0.875rem; border-radius: 0.5rem; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
                .btn-primary:hover:not(:disabled) { background-color: #4338ca; }
                .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
             `}</style>
        </div>
    );
}