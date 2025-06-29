// src/salesops/ProductReturnList.jsx
import React from 'react';
import { formatDisplayDate } from '../utils/dateUtils';

const ProductReturnList = ({ returns = [], isLoading }) => {
    return (
        <div className="mt-6 md:mt-0">
            <h3 className="text-md font-semibold text-gray-700 mb-3">บันทึกคืนสินค้า</h3>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">สินค้า</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">จำนวน</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">เหตุผล</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">บันทึกเมื่อ</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-sm">
                            {isLoading ? (
                                <tr><td colSpan="4" className="p-4 text-center text-gray-500">กำลังโหลด...</td></tr>
                            ) : returns.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-4 py-4 text-center text-gray-500">ไม่มีการบันทึกคืนสินค้าสำหรับการเลือกนี้</td>
                                </tr>
                            ) : (
                                returns.map(item => (
                                    <tr key={item.return_id}>
                                        <td className="px-4 py-2 whitespace-nowrap font-medium">{item.product_name}</td>
                                        <td className="px-4 py-2 whitespace-nowrap">{item.quantity_returned}</td>
                                        <td className="px-4 py-2 whitespace-nowrap">{item.custom_reason_for_loss}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-gray-500">{formatDisplayDate(item.created_at, 'th-TH', { hour: '2-digit', minute: '2-digit'})}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProductReturnList;