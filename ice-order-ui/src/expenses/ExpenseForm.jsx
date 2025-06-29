// Suggested path: src/expenses/ExpenseForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../Modal'; // Assuming Modal.jsx is in the same directory
import { formatDateForInput, getCurrentLocalDateISO } from '../utils/dateUtils'; // Adjust path

const ExpenseForm = ({
    isOpen,
    onClose,
    onSave, // Function from ExpenseListManager to handle API call
    expense, // Current expense being edited (null if adding new)
    categories = [] // Array of active category objects
}) => {
    const getInitialFormState = useCallback(() => ({
        expense_date: getCurrentLocalDateISO(), // Default to today
        category_id: categories.length > 0 ? categories[0].category_id.toString() : '',
        description: '',
        amount: '',
        payment_method: '',
        reference_details: '',
        is_petty_cash_expense: false,
        related_document_url: '' // For future file uploads
    }), [categories]); // Memoize initial state to avoid unnecessary re-renders

    const [formData, setFormData] = useState(getInitialFormState);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) { // Only reset/populate when modal becomes visible
            if (expense) {
                setFormData({
                    expense_date: formatDateForInput(expense.expense_date),
                    category_id: expense.category_id?.toString() || '',
                    description: expense.description || '',
                    amount: expense.amount?.toString() || '',
                    payment_method: expense.payment_method || '',
                    reference_details: expense.reference_details || '',
                    is_petty_cash_expense: expense.is_petty_cash_expense || false,
                    related_document_url: expense.related_document_url || ''
                });
            } else {
                setFormData(getInitialFormState()); // Reset to initial state                
            }
            setError(''); // Clear any previous errors
        }
    }, [expense, isOpen, categories, getInitialFormState]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Basic Validation
        if (!formData.expense_date) { setError('กรุณาระบุวันที่ของค่าใช้จ่าย.'); return; }
        if (!formData.category_id) { setError('กรุณาระบุหมวดหมู่ของค่าใช้จ่าย.'); return; }
        if (!formData.description.trim()) { setError('กรุณาระบุรายละเอียดของค่าใช้จ่าย.'); return; }
        if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
            setError('กรุณาระบุจำนวนเงินที่ถูกต้อง.'); return;
        }

        setIsLoading(true);
        try {
            const payload = {
                ...formData,
                amount: parseFloat(formData.amount),
                category_id: parseInt(formData.category_id),
                // is_petty_cash_expense is already a boolean from checkbox
            };
            // Remove empty optional fields if backend prefers null or not present
            if (!payload.payment_method) delete payload.payment_method;
            if (!payload.reference_details) delete payload.reference_details;
            if (!payload.related_document_url) delete payload.related_document_url;


            await onSave(payload); // Call the save handler from ExpenseListManager
            // Parent (ExpenseListManager) will handle closing modal and re-fetching data on success
        } catch (err) {
            console.error("Error in ExpenseForm submit:", err);
            setError(err.message || 'บันทึกค่าใช้จ่ายไม่สำเร็จ.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={expense ? 'แก้ไขรายการค่าใช้จ่าย' : 'บันทึกรายการค่าใช้จ่ายใหม่'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="expense_date" className="block text-sm font-medium text-gray-700 mb-1">
                            วันที่ <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            name="expense_date"
                            id="expense_date"
                            value={formData.expense_date}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div>
                        <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">
                            หมวดหมู่ <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="category_id"
                            id="category_id"
                            value={formData.category_id}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
                            required
                            disabled={isLoading || categories.length === 0}
                        >
                            <option value="" disabled>{categories.length === 0 ? "กำลังโหลดหมวดหมู่..." : "เลือกหมวดหมู่"}</option>
                            {categories.map(cat => (
                                <option key={cat.category_id} value={cat.category_id.toString()}>
                                    {cat.category_name}
                                </option>
                            ))}
                        </select>
                         {categories.length === 0 && !isLoading && <p className="text-xs text-red-500 mt-1">ไม่มีหมวดหมู่ที่ใช้งานได้ กรุณาเพิ่มหมวดหมู่ก่อน.</p>}
                    </div>
                </div>

                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                        รายละเอียด <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        name="description"
                        id="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
                        placeholder="รายละเอียดของค่าใช้จ่าย เช่น ค่าซื้ออุปกรณ์, ค่าเดินทาง"
                        required
                        disabled={isLoading}
                    ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                            จำนวนเงิน (บาท) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            name="amount"
                            id="amount"
                            value={formData.amount}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
                            placeholder="เช่น 150.50"
                            step="0.01"
                            min="0.01"
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div>
                        <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700 mb-1">
                            วิธีการชำระเงิน
                        </label>
                        <input
                            type="text"
                            name="payment_method"
                            id="payment_method"
                            value={formData.payment_method}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
                            placeholder="เช่น เงินสด, โอนผ่านธนาคาร"
                            disabled={isLoading}
                        />
                    </div>
                </div>
                
                <div>
                    <label htmlFor="reference_details" className="block text-sm font-medium text-gray-700 mb-1">
                        อ้างอิง/รายละเอียด (ไม่บังคับ)
                    </label>
                    <input
                        type="text"
                        name="reference_details"
                        id="reference_details"
                        value={formData.reference_details}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
                        placeholder="เช่น ใบแจ้งหนี้ #123, เช็ค #456"
                        disabled={isLoading}
                    />
                </div>

                <div className="flex items-center">
                    <input
                        id="is_petty_cash_expense"
                        name="is_petty_cash_expense"
                        type="checkbox"
                        checked={formData.is_petty_cash_expense}
                        onChange={handleChange}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                        disabled={isLoading}
                    />
                    <label htmlFor="is_petty_cash_expense" className="ml-2 block text-sm text-gray-900">
                        จ่ายจากเงินสดย่อยหรือไม่?
                    </label>
                </div>

                {/* Placeholder for file upload in the future
                <div>
                    <label htmlFor="related_document_url" className="block text-sm font-medium text-gray-700 mb-1">
                        Attach Receipt (Optional)
                    </label>
                    <input
                        type="file"
                        name="related_document_url_file" // Name for file input
                        id="related_document_url_file"
                        // onChange={handleFileChange} // You'd need a handleFileChange function
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
                        disabled={isLoading}
                    />
                </div>
                */}

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
                        disabled={isLoading || (categories.length === 0 && !expense)} // Disable save if no categories and adding new
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
                        ) : (expense ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มค่าใช้จ่าย')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ExpenseForm;
