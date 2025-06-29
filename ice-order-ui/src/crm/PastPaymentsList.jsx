// ice-delivery-app/ice-order-ui/src/crm/PastPaymentsList.jsx
import React from 'react';
import { EditIcon } from '../components/Icons'; // Assuming you have an EditIcon

// A simple icon for Void
const VoidIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
);


const formatCurrency = (amount) => `฿${parseFloat(amount || 0).toFixed(2)}`;

const PastPaymentsList = ({ payments = [], isLoading, onEdit, onVoid, userRole }) => {
    const canManage = userRole === 'admin' || userRole === 'manager';

    if (isLoading) return <div className="p-4 text-center text-gray-500">กำลังโหลดประวัติการชำระเงิน...</div>;
    if (payments.length === 0) return <div className="p-4 text-center text-gray-500 border rounded-md bg-gray-50">ไม่พบการชำระเงินสำหรับเกณฑ์ที่เลือก</div>;

    return (
        <div className="space-y-3">
            <h3 className="font-semibold text-lg text-gray-700">ประวัตวัติการชำระเงิน</h3>
            <div className="border rounded-lg overflow-hidden">
                <ul className="divide-y divide-gray-200">
                    {payments.map(payment => (
                        <li key={payment.payment_id} className={`p-3 text-sm hover:bg-gray-50 ${payment.is_voided ? 'bg-red-50 opacity-60' : ''}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-medium text-gray-800">
                                        {formatCurrency(payment.amount_paid)}
                                        <span className="ml-2 text-xs font-normal text-gray-500">({payment.payment_method})</span>
                                        {payment.is_voided && <span className="ml-2 text-xs font-bold text-red-600">(VOIDED)</span>}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        Paid on: {new Date(payment.payment_date).toLocaleDateString('th-TH')}
                                    </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {payment.slip_image_url && (
                                        <a href={payment.slip_image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                                            ดูสลิป
                                        </a>
                                    )}
                                    {/* Show buttons only if user is admin/manager and payment is not voided */}
                                    {canManage && !payment.is_voided && (
                                        <>
                                            <button onClick={() => onEdit(payment)} className="p-1 text-indigo-600 hover:bg-indigo-100 rounded" title="แก้ไขการชำระเงิน">
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => onVoid(payment.payment_id)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Void การชำระเงิน">
                                                <VoidIcon />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {payment.notes && <p className="text-xs italic text-gray-500 mt-1 pl-1 border-l-2 border-gray-200">{payment.notes}</p>}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default PastPaymentsList;