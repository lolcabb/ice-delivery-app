// Suggested path: src/expenses/PettyCashLogForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../Modal'; // Assuming Modal.jsx is in the same directory

import { formatDateForInput, getCurrentLocalDateISO } from '../utils/dateUtils'; // Adjust path if necessary

// Define static fields outside the component for a stable reference
const STATIC_PETTY_CASH_FIELDS = {
    opening_balance: '',
    cash_received_amount: '',
    cash_received_description: '',
    notes: '',
    reimbursement_requested_amount: '',
    reimbursement_approved_amount: '',
    reimbursement_date: '',
};

// Helper to format currency for display (read-only fields)
const formatCurrencyDisplay = (amount) => {
    if (amount === null || amount === undefined || isNaN(parseFloat(amount))) return 'N/A';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 }).format(amount);
};


const PettyCashLogForm = ({
    isOpen,
    onClose,
    onSave,
    logEntry,
}) => {
    // Function to generate the full initial state, memoized with useCallback
    // Since getCurrentLocalDateISO and STATIC_PETTY_CASH_FIELDS are stable,
    // this useCallback has no dependencies and will also be stable.
    const getInitialFormState = useCallback(() => ({
        ...STATIC_PETTY_CASH_FIELDS,
        log_date: getCurrentLocalDateISO(),
    }), []); // Empty dependency array means this function reference is stable

    const [formData, setFormData] = useState(getInitialFormState());
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // --- **MODIFICATION**: Get user role and determine editing permissions ---
    const [isAdmin, setIsAdmin] = useState(false);
    const isEditing = Boolean(logEntry && logEntry.log_id);

    useEffect(() => {
        const authUser = JSON.parse(localStorage.getItem('authUser'));
        setIsAdmin(authUser?.role?.toLowerCase() === 'admin');

        // This effect now ONLY resets the form data when the modal opens or the log entry changes.
        if (isOpen) {
            setFormData({
                log_date: logEntry ? formatDateForInput(logEntry.log_date) : getCurrentLocalDateISO(),
                opening_balance: logEntry ? (logEntry.opening_balance?.toString() || '0') : '',
                cash_received_amount: logEntry ? (logEntry.cash_received_amount?.toString() || '') : '',
                cash_received_description: logEntry ? (logEntry.cash_received_description || '') : '',
                notes: logEntry ? (logEntry.notes || '') : '',
                reimbursement_requested_amount: logEntry ? (logEntry.reimbursement_requested_amount?.toString() || '') : '',
                reimbursement_approved_amount: logEntry ? (logEntry.reimbursement_approved_amount?.toString() || '') : '',
                reimbursement_date: logEntry && logEntry.reimbursement_date ? formatDateForInput(logEntry.reimbursement_date) : '',
            });
            setError(''); // Clear previous errors
        }
    }, [isOpen, logEntry]); // Dependencies are correct
    // --- End of Modification ---

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Basic Validation
        if (!formData.log_date) { setError('กรุณาระบุวันที่บันทึก.'); return; }
        if (!isEditing && (!formData.opening_balance || isNaN(parseFloat(formData.opening_balance)))) {
            setError('ยอดยกมาต้องเป็นตัวเลขที่ถูกต้องสำหรับบันทึกใหม่.'); return;
        }
        if (formData.opening_balance && isNaN(parseFloat(formData.opening_balance))) {
             setError('ยอดยกมาต้องเป็นตัวเลขหากระบุ.'); return;
        }
        if (formData.cash_received_amount && isNaN(parseFloat(formData.cash_received_amount))) {
            setError('จำนวนเงินสดรับต้องเป็นตัวเลขหากระบุ.'); return;
        }
        if (formData.reimbursement_requested_amount && isNaN(parseFloat(formData.reimbursement_requested_amount))) {
            setError('จำนวนเงินขอเบิกชดเชยต้องเป็นตัวเลขหากระบุ.'); return;
        }
        if (formData.reimbursement_approved_amount && isNaN(parseFloat(formData.reimbursement_approved_amount))) {
            setError('จำนวนเงินอนุมัติเบิกชดเชยต้องเป็นตัวเลขหากระบุ.'); return;
        }


        setIsLoading(true);
        try {
            const payload = {
                ...formData,
                opening_balance: parseFloat(formData.opening_balance || 0),
                cash_received_amount: formData.cash_received_amount !== '' ? parseFloat(formData.cash_received_amount) : null,
                reimbursement_requested_amount: formData.reimbursement_requested_amount !== '' ? parseFloat(formData.reimbursement_requested_amount) : null,
                reimbursement_approved_amount: formData.reimbursement_approved_amount !== '' ? parseFloat(formData.reimbursement_approved_amount) : null,
                reimbursement_date: formData.reimbursement_date || null,
            };

            // For new entries, opening_balance is required
            if (!isEditing && payload.opening_balance === undefined) {
                 setError('จำเป็นต้องระบุยอดยกมาสำหรับบันทึกใหม่.');
                 setIsLoading(false);
                 return;
            }
            
            // Filter out undefined fields from payload if backend doesn't like them for updates
            Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);


            await onSave(payload); // This calls handleSaveLog in PettyCashLogManager
            // Parent (PettyCashLogManager) will handle closing modal and re-fetching.
        } catch (err) {
            console.error("Error in PettyCashLogForm submit:", err);
            setError(err.message || 'บันทึกเงินสดย่อยไม่สำเร็จ.');
        } finally {
            setIsLoading(false);
        }
    };

    const canEditProtectedFields = isEditing && isAdmin;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `แก้ไขบันทึกสำหรับวันที่ ${formatDateForInput(formData.log_date)}` : 'เริ่มบันทึกเงินสดย่อยวันใหม่g'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="log_date" className="block text-sm font-medium text-gray-700 mb-1">
                        วันที่บันทึก <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        name="log_date"
                        id="log_date"
                        value={formData.log_date}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                        required
                        disabled={isLoading || (isEditing && !isAdmin)} // Date cannot be changed once log is created
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="opening_balance" className="block text-sm font-medium text-gray-700 mb-1">
                            ยอดยกมา (฿) <span className={isEditing ? "" : "text-red-500"}>{isEditing ? "" : "*"}</span>
                        </label>
                        <input
                            type="number"
                            name="opening_balance"
                            id="opening_balance"
                            value={formData.opening_balance}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                            placeholder="เช่น, 5000.00"
                            step="0.01"
                            required={!isEditing}
                            disabled={isLoading || (isEditing && !isAdmin)} // Opening balance typically not editable after creation
                        />
                    </div>
                    <div>
                        <label htmlFor="cash_received_amount" className="block text-sm font-medium text-gray-700 mb-1">
                            ยอดเงินสดที่ได้รับวันนี้ (฿)
                        </label>
                        <input
                            type="number"
                            name="cash_received_amount"
                            id="cash_received_amount"
                            value={formData.cash_received_amount}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
                            placeholder="เช่น, 2000.00"
                            step="0.01"
                            disabled={isLoading}
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="cash_received_description" className="block text-sm font-medium text-gray-700 mb-1">
                        รายละเอียดเงินสดที่ได้รับ
                    </label>
                    <input
                        type="text"
                        name="cash_received_description"
                        id="cash_received_description"
                        value={formData.cash_received_description}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
                        placeholder="เช่น, จากแคชเชียร์หลัก"
                        disabled={isLoading}
                    />
                </div>

                {isEditing && (
                    <div className="p-3 bg-gray-50 rounded-md border border-gray-200 space-y-2">
                        <h4 className="text-sm font-medium text-gray-600">ตัวเลขคำนวณ (อ่านอย่างเดียว)</h4>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">ค่าใช้จ่ายรายวันทั้งหมด:</span>
                            <span className="font-semibold text-red-600">{formatCurrencyDisplay(logEntry?.total_daily_petty_expenses)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">ยอดคงเหลือตามบัญชี:</span>
                            <span className="font-semibold text-gray-800">{formatCurrencyDisplay(logEntry?.closing_balance)}</span>
                        </div>
                    </div>
                )}

                <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                        หมายเหตุ / ข้อสังเกต
                    </label>
                    <textarea
                        name="notes"
                        id="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
                        placeholder="หมายเหตุสำหรับบันทึกในวันนี้"
                        disabled={isLoading}
                    ></textarea>
                </div>

                <fieldset className="mt-4 border-t border-gray-200 pt-4">
                    <legend className="text-sm font-medium text-gray-700 mb-2">รายละเอียดการเบิกชดเชย (ไม่บังคับ)</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="reimbursement_requested_amount" className="block text-sm font-medium text-gray-700 mb-1">ยอดเงินที่ขอเบิก (฿)</label>
                            <input type="number" name="reimbursement_requested_amount" id="reimbursement_requested_amount" value={formData.reimbursement_requested_amount} onChange={handleChange} step="0.01" className="w-full input-field disabled:bg-gray-50" placeholder="จำนวนเงิน" disabled={isLoading}/>
                        </div>
                        <div>
                            <label htmlFor="reimbursement_approved_amount" className="block text-sm font-medium text-gray-700 mb-1">ยอดเงินที่อนุมัติ (฿)</label>
                            <input type="number" name="reimbursement_approved_amount" id="reimbursement_approved_amount" value={formData.reimbursement_approved_amount} onChange={handleChange} step="0.01" className="w-full input-field disabled:bg-gray-50" placeholder="จำนวนเงิน" disabled={isLoading}/>
                        </div>
                        <div>
                            <label htmlFor="reimbursement_date" className="block text-sm font-medium text-gray-700 mb-1">วันที่เบิกชดเชย</label>
                            <input type="date" name="reimbursement_date" id="reimbursement_date" value={formData.reimbursement_date} onChange={handleChange} className="w-full input-field disabled:bg-gray-50" disabled={isLoading}/>
                        </div>
                    </div>
                </fieldset>
                
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                        <p>{error}</p>
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200 mt-5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-indigo-400 flex items-center justify-center"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                กำลังประมวลผล...
                            </>
                        ) : (isEditing ? 'บันทึกการเปลี่ยนแปลง' : 'เริ่มบันทึกประจำวัน')}
                    </button>
                </div>
            </form>
            {/* Simple CSS for input-field, assuming you have a global CSS or Tailwind setup */}
            <style jsx>{`
                .input-field {
                    display: block;
                    width: 100%;
                    padding-left: 0.75rem; /* px-3 */
                    padding-right: 0.75rem; /* px-3 */
                    padding-top: 0.5rem; /* py-2 */
                    padding-bottom: 0.5rem; /* py-2 */
                    border-width: 1px;
                    border-color: #D1D5DB; /* border-gray-300 */
                    border-radius: 0.375rem; /* rounded-md */
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
                }
                .input-field:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                    border-color: #6366F1; /* focus:border-indigo-500 */
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5); /* focus:ring-indigo-500 with opacity */
                }
                .input-field.sm\\:text-sm { /* If you use sm:text-sm on inputs */
                    font-size: 0.875rem; /* text-sm */
                    line-height: 1.25rem;
                }
            `}</style>
        </Modal>
    );
};

export default PettyCashLogForm;
