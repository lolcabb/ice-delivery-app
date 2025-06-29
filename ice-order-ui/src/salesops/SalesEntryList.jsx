// src/salesops/SalesEntryList.jsx

import React from 'react';
import { EditIcon, TrashIcon,  DuplicateIcon } from '../components/Icons'; // Assuming you have these
import { formatDisplayDate } from '../utils/dateUtils';

const SalesEntryList = ({ sales = [], onDuplicate, onEdit, onDelete }) => {
    if (sales.length === 0) {
        return (
            <div className="mt-4 p-4 text-center bg-gray-50 rounded-lg border-dashed border-gray-300 border">
                <p className="text-sm text-gray-500">ยังไม่มีการบันทึกการขายสำหรับพนักงานขับรถคนนี้ในวันนี้</p>
            </div>
        );
    }

    const formatCurrency = (amount) => (parseFloat(amount) || 0).toFixed(2);

    return (
        <div className="mt-6">
            <h3 className="text-md font-semibold text-gray-700 mb-2">บันทึกการขาย</h3>
            <div className="space-y-2">
                {sales.map(sale => (
                    <div key={sale.sale_id} className="bg-white p-3 rounded-md border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold text-gray-800">
                                    {sale.customer_name_override || sale.actual_customer_name || 'ลูกค้าไม่ประจำ'}
                                </p>
                                <p className="text-xs text-gray-500">
                                    Sale ID: {sale.sale_id} &bull; {sale.payment_type} &bull; {formatDisplayDate(sale.sale_timestamp, 'th-TH', { hour: '2-digit', minute: '2-digit'})}
                                </p>
                            </div>
                            <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                                {/* The onEdit prop will be passed from SalesEntryManager */}
                                <button onClick={() => onEdit(sale)} title="แก้ไขการขาย" className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-md"><EditIcon className="w-4 h-4" /></button>
                                <button onClick={() => onDelete(sale.sale_id)} title="ลบการขาย" className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100">
                            <ul className="text-xs text-gray-600 space-y-0.5">
                                {sale.sale_items.map(item => (
                                    <li key={item.item_id} className="flex justify-between">
                                        <span>{item.product_name} x {item.quantity_sold}</span>
                                        <span>{formatCurrency(item.quantity_sold * item.unit_price)} ฿</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-right font-bold text-sm text-gray-800 mt-1">
                                รวม: {formatCurrency(sale.total_sale_amount)} ฿
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SalesEntryList;