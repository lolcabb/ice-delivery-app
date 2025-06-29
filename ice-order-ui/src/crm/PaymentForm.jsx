// ice-delivery-app/ice-order-ui/src/crm/PaymentForm.jsx
import React, { useState, useEffect } from 'react';
import { getCurrentLocalDateISO } from '../utils/dateUtils';

const formatCurrency = (amount) => `฿${parseFloat(amount || 0).toFixed(2)}`;

const PaymentForm = ({ totalSelectedAmount, onSubmit, hasSelection }) => {
    const [paymentData, setPaymentData] = useState({
        payment_date: getCurrentLocalDateISO(),
        amount_paid: '',
        payment_method: 'Bank Transfer',
        notes: ''
    });
    const [paymentSlipFile, setPaymentSlipFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setPaymentData(prev => ({ ...prev, amount_paid: totalSelectedAmount.toFixed(2) }));
    }, [totalSelectedAmount]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setPaymentData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
            setPaymentSlipFile(file);
            setFilePreview(URL.createObjectURL(file));
        } else if (file) { // if a file is selected but it's not a valid type
            alert('Please select a valid image file (JPG or PNG).');
            e.target.value = null; // Clear the input
            setPaymentSlipFile(null);
            setFilePreview(null);
        }
    };

    const handleRemoveFile = () => {
        setPaymentSlipFile(null);
        setFilePreview(null);
        // Also reset the file input visually
        document.getElementById('payment_slip_image_input').value = null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmit(paymentData, paymentSlipFile);
        if (success) {
            // Clear form on successful submission
            setPaymentData({
                payment_date: getCurrentLocalDateISO(),
                amount_paid: '',
                payment_method: 'Bank Transfer',
                notes: ''
            });
            setPaymentSlipFile(null);
            setFilePreview(null);
        }
        setIsSubmitting(false);
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 bg-gray-50 border rounded-md space-y-4">
            <h3 className="font-semibold text-lg">สร้างรายการชำระเงิน</h3>
            <div className="p-3 text-center bg-blue-100 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">ยอดรวมที่เลือก</p>
                <p className="text-2xl font-bold text-blue-800">{formatCurrency(totalSelectedAmount)}</p>
            </div>
            
            <div>
                <label className="block text-sm font-medium">วันที่ชำระเงิน *</label>
                <input type="date" name="payment_date" value={paymentData.payment_date} onChange={handleChange} className="w-full input-field" required disabled={!hasSelection} />
            </div>
            <div>
                <label className="block text-sm font-medium">จำนวนเงินที่ชำระ *</label>
                <input type="number" name="amount_paid" value={paymentData.amount_paid} onChange={handleChange} className="w-full input-field" required disabled={!hasSelection} step="0.01"/>
            </div>
            <div>
                <label className="block text-sm font-medium">วิธีการชำระเงิน *</label>
                <select name="payment_method" value={paymentData.payment_method} onChange={handleChange} className="w-full input-field" required disabled={!hasSelection}>
                    <option>โอนเงินผ่านธนาคาร</option>
                    <option>เงินสด</option>
                    <option>อื่นๆ</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">อัพโหลดหลักฐานการชำระเงิน (ถ้ามี)</label>
                <div className="mt-1 flex items-center space-x-3">
                    {/* This is the styled "button" that the user sees and clicks */}
                    <label htmlFor="payment_slip_image_input" className="cursor-pointer px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 border border-transparent rounded-md shadow-sm hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <span>เลือกไฟล์</span>
                    </label>

                    {/* This is the actual file input, which is now hidden */}
                    <input 
                        type="file" 
                        id="payment_slip_image_input" 
                        name="payment_slip_image"
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept="image/jpeg, image/png" 
                        disabled={!hasSelection}
                    />
                    
                    {/* This section displays the name of the chosen file */}
                    {paymentSlipFile && (
                        <div className="flex items-center text-sm text-gray-600">
                            <span className="truncate max-w-40">{paymentSlipFile.name}</span>
                            <button type="button" onClick={handleRemoveFile} className="ml-2 text-red-500 hover:text-red-700" title="Remove file">
                                &times;
                            </button>
                        </div>
                    )}
                </div>
                {filePreview && <img src={filePreview} alt="Slip preview" className="mt-2 rounded-md border p-1 max-h-40" />}
            </div>
            <div>
                <label className="block text-sm font-medium">หมายเหตุ</label>
                <textarea name="notes" value={paymentData.notes} onChange={handleChange} className="w-full input-field" rows="2" disabled={!hasSelection}></textarea>
            </div>
            <button type="submit" className="w-full btn-primary" disabled={!hasSelection || isSubmitting}>
                {isSubmitting ? 'กำลังส่ง...' : 'บันทึกการชำระเงิน'}
            </button>
        </form>
    );
};

export default PaymentForm;