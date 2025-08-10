// Suggested path: src/expenses/ExpenseForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../Modal';
import { formatDateForInput, getCurrentLocalDateISO } from '../utils/dateUtils';

const ExpenseForm = ({
    isOpen,
    onClose,
    onSave,
    expense,
    categories = []
}) => {
    const getInitialFormState = useCallback(() => ({
        expense_date: getCurrentLocalDateISO(), // Default to today
        paid_date: '',
        category_id: categories.length > 0 ? categories[0].category_id.toString() : '',
        description: '',
        amount: '',
        payment_method: '',
        reference_details: '',
        is_petty_cash_expense: false,
        related_document_url: ''
    }), [categories]);

    const [formData, setFormData] = useState(getInitialFormState);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [receiptFile, setReceiptFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);

    useEffect(() => {
        if (isOpen) {
            if (expense) {
                setFormData({
                    expense_date: formatDateForInput(expense.expense_date),
                    paid_date: expense.paid_date ? formatDateForInput(expense.paid_date) : '',
                    category_id: expense.category_id?.toString() || '',
                    description: expense.description || '',
                    amount: expense.amount?.toString() || '',
                    payment_method: expense.payment_method || '',
                    reference_details: expense.reference_details || '',
                    is_petty_cash_expense: expense.is_petty_cash_expense || false,
                    related_document_url: expense.related_document_url || ''
                });

                if (expense.related_document_url) {
                    setFilePreview(expense.related_document_url)
                }

            } else {
                setFormData(getInitialFormState());
                setReceiptFile(null);
                setFilePreview(null);              
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

    // FILE HANDLING FUNCTIONS
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
            setReceiptFile(file);
            setFilePreview(URL.createObjectURL(file));
        } else if (file) {
            alert('กรุณาเลือกไฟล์รูปภาพ (JPG หรือ PNG) เท่านั้น');
            e.target.value = null;
            setReceiptFile(null);
            setFilePreview(null);
        }
    };

    const handleRemoveFile = () => {
        setReceiptFile(null);
        setFilePreview(null);
        // Clear the file input
        const fileInput = document.getElementById('receipt_file_input');
        if (fileInput) {
            fileInput.value = null;
        }
        // If editing an existing expense, we should also clear the related_document_url
        if (expense) {
            setFormData(prev => ({ ...prev, related_document_url: '' }));
        }
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
            // === PREPARE DATA FOR FILE UPLOAD ===
            const effectivePaidDate = formData.paid_date || formData.expense_date;
            const submitData = {
                ...formData,
                paid_date: effectivePaidDate,
                amount: parseFloat(formData.amount),
                category_id: parseInt(formData.category_id),
                is_petty_cash_expense: formData.is_petty_cash_expense
            };

            // Add file if present
            if (receiptFile) {
                submitData.receipt_file = receiptFile;
            }

            await onSave(submitData, expense?.expense_id);
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        <label htmlFor="paid_date" className="block text-sm font-medium text-gray-700 mb-1">
                            วันที่ชำระ
                        </label>
                        <input
                            type="date"
                            name="paid_date"
                            id="paid_date"
                            value={formData.paid_date}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
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

                {/* === FILE UPLOAD SECTION === */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        แนบใบเสร็จ/ใบสำคัญ (ถ้ามี)
                    </label>
                    <div className="mt-1 flex items-center space-x-3">
                        {/* File Input Button */}
                        <label htmlFor="receipt_file_input" className="cursor-pointer px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 border border-transparent rounded-md shadow-sm hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                            <span>เลือกไฟล์</span>
                        </label>

                        {/* Hidden File Input */}
                        <input
                            type="file"
                            id="receipt_file_input"
                            name="receipt_file"
                            onChange={handleFileChange}
                            className="hidden"
                            accept="image/jpeg, image/png"
                            disabled={isLoading}
                        />

                        {/* File Info Display */}
                        {receiptFile && (
                            <div className="flex items-center text-sm text-gray-600">
                                <span className="truncate max-w-40">{receiptFile.name}</span>
                                <button
                                    type="button"
                                    onClick={handleRemoveFile}
                                    className="ml-2 text-red-500 hover:text-red-700"
                                    title="ลบไฟล์"
                                >
                                    &times;
                                </button>
                            </div>
                        )}
                        
                        {/* Show existing file URL if editing */}
                        {!receiptFile && expense?.related_document_url && (
                            <div className="flex items-center text-sm text-gray-600">
                                <span>ไฟล์เดิม</span>
                                <button
                                    type="button"
                                    onClick={handleRemoveFile}
                                    className="ml-2 text-red-500 hover:text-red-700"
                                    title="ลบไฟล์"
                                >
                                    &times;
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* File Preview */}
                    {filePreview && (
                        <div className="mt-2">
                            <img
                                src={filePreview}
                                alt="ตัวอย่างใบเสร็จ"
                                className="rounded-md border p-1 max-h-40 object-contain"
                            />
                        </div>
                    )}
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
                        ค่าใช้จ่ายเงินสดย่อย
                    </label>
                </div>

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
