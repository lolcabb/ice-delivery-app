// src/salesops/LoadingLogList.jsx
import React, { useState } from 'react';
import { formatDisplayDate } from '../utils/dateUtils';
import { ChevronIcon, EditIcon } from '../components/Icons';

// A small component to render key-value pairs for details
const DetailItem = ({ label, value }) => (
    <div>
        <span className="text-xs font-medium text-gray-500">{label}:</span>
        <p className="text-sm text-gray-800">{value || <span className="italic text-gray-400">N/A</span>}</p>
    </div>
);

const LoadingLogList = ({ groupedLogs, isLoading, onEditBatch }) => { 
    const [expandedBatchId, setExpandedBatchId] = useState(null);

    const toggleExpandBatch = (batchId) => {
        setExpandedBatchId(prevId => (prevId === batchId ? null : prevId));
    };

    if (isLoading && groupedLogs.length === 0) {
        return (
            <div className="text-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600 mx-auto"></div>
                <p className="mt-3 text-sm text-gray-500">กำลังโหลดบันทึก...</p>
            </div>
        );
    }

    if (!isLoading && groupedLogs.length === 0) {
        return (
            <div className="bg-gray-50 p-6 rounded-md text-center border-2 border-dashed border-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-md font-medium text-gray-700">ไม่พบบันทึกการขึ้นของ</h3>
                <p className="mt-1 text-sm text-gray-500">
                    ไม่มีบันทึกการขึ้นของที่ตรงกับตัวกรองปัจจุบัน หรือยังไม่มีการสร้างบันทึก
                </p>
            </div>
        );
    }
    
    return (
        <div className="space-y-3">
            {groupedLogs.map((batch) => {
                const isExpanded = expandedBatchId === batch.batch_id;
                const totalQuantity = batch.items.reduce((sum, item) => sum + parseFloat(item.quantity_loaded || 0), 0);

                return (
                    <div key={batch.batch_id} className="bg-white rounded-lg shadow-sm border border-gray-200 transition-shadow hover:shadow-md">
                        {/* Card Header */}
                        <div className="p-4 flex justify-between items-start">
                            <div>
                                <p className="font-bold text-lg text-gray-800">{batch.driver_name}</p>
                                <p className="text-xs text-gray-500">
                                    {formatDisplayDate(batch.load_timestamp, 'en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <button
                                onClick={() => onEditBatch(batch)}
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
                                title="แก้ไขการขึ้นของ"
                            >
                                <EditIcon />
                            </button>
                        </div>

                        {/* Card Body with Details */}
                        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                            <DetailItem label="ประเภท" value={batch.load_type} />
                            <DetailItem label="เส้นทาง" value={batch.route_name} />
                            <DetailItem label="จำนวนรวม" value={`${totalQuantity} ถุง`} />
                            <DetailItem label="ผู้บันทึก" value={batch.area_manager_name} />
                            {batch.notes && (
                                <div className="col-span-full">
                                     <DetailItem label="หมายเหตุ" value={batch.notes} />
                                </div>
                            )}
                        </div>

                        {/* Footer & Expandable Section */}
                        <div className="border-t border-gray-200 bg-gray-50/70 rounded-b-lg">
                             <button 
                                onClick={() => toggleExpandBatch(batch.batch_id)} 
                                className="w-full flex justify-between items-center px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                                aria-expanded={isExpanded}
                            >
                                <span>ดูรายการสินค้า ({batch.items.length})</span>
                                <ChevronIcon isExpanded={isExpanded} />
                            </button>
                            
                            {isExpanded && (
                                <div className="px-6 pb-4 pt-2">
                                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                                        {batch.items.map((item, index) => (
                                            <li key={item.product_id + '-' + index}>
                                                {item.product_name || `Product ID: ${item.product_id}`} - 
                                                <span className="font-semibold"> {item.quantity_loaded}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

             {isLoading && groupedLogs.length > 0 && (
                <div className="py-3 text-center text-xs text-gray-400">กำลังอัปเดตรายการ...</div>
            )}
        </div>
    );
};

export default LoadingLogList;
