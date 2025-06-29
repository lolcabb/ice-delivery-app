// src/crm/ContainerAssignmentList.jsx
import React from 'react';

// --- Icon Components ---
const ChevronRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
);

const ReturnIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
);

const EditIcon = () => ( // Added EditIcon
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
);

const ChevronLeftPaginationIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
);

const ChevronRightPaginationIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
);
// --- End Icon Components ---

const DetailItem = ({ label, value, fullWidth = false, isDate = false, isDateTime = false }) => {
    let displayValue = value || '-';
    if (value) {
        if (isDateTime) {
            displayValue = new Date(value).toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } else if (isDate) {
            displayValue = new Date(value).toLocaleDateString('en-CA'); // YYYY-MM-DD
        }
    }
    return (
        <div className={`py-1 ${fullWidth ? 'md:col-span-2' : ''}`}>
            <strong className="font-semibold text-gray-600">{label}:</strong>
            <span className="ml-2 text-gray-800 whitespace-pre-wrap">{displayValue}</span>
        </div>
    );
};

const ContainerAssignmentList = ({
    assignments,
    isLoading,
    pagination,
    onPageChange,
    onMarkAsReturned,
    onOpenEditModal, // New prop for editing
    expandedAssignmentId,
    onToggleExpandDetails
}) => {
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString); // Directly parse the date string
        if (isNaN(date.getTime())) { // Check if the date is valid
            return 'Invalid Date'; // Return this if parsing failed
        }
        return date.toLocaleDateString('en-CA'); // Format to YYYY-MM-DD
    };
    
    const isOverdue = (expectedDateStr, returnedDateStr) => {
        if (!expectedDateStr || returnedDateStr) return false; // Not overdue if no expected date or already returned
        const today = new Date();
        today.setHours(0,0,0,0); // Compare dates only
        const expectedDate = new Date(expectedDateStr + 'T00:00:00');
        return expectedDate < today;
    };


    if (isLoading && (!assignments || assignments.length === 0)) {
        return ( 
		    <div className="text-center py-12">
                {/* Using a simple text or your custom Spinner component */}
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">กำลังโหลดการมอบหมายถัง...</p>
            </div>
		);
    }
    if (!isLoading && (!assignments || assignments.length === 0)) {
        return ( 
		    <div className="bg-white shadow rounded-lg p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">ไม่พบการมอบหมายถังน้ำแข็ง</h3>
                <p className="mt-1 text-sm text-gray-500">
                    ไม่พบการมอบหมายที่ตรงกับตัวกรองปัจจุบันของคุณ หรือยังไม่มีการมอบหมายใดๆ
                </p>
            </div>
		);
    }

    return (
        <div className="bg-white shadow border-b border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="w-10 px-3 py-3"></th> {/* Expander */}
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ถังน้ำแข็ง</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ลูกค้า</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่มอบหมาย</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่คาดว่าจะคืน</th> {/* New Header */}
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะการคืน</th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">การดำเนินการ</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {assignments.map((assignment) => {
                            const isExpanded = expandedAssignmentId === assignment.assignment_id;
                            const overdue = isOverdue(assignment.expected_return_date, assignment.returned_date);

                            return (
                                <React.Fragment key={assignment.assignment_id}>
                                    <tr
                                        className={`hover:bg-gray-50 transition-colors duration-150 ease-in-out ${overdue ? 'bg-red-50 hover:bg-red-100' : ''}`}
                                        onClick={() => onToggleExpandDetails(assignment.assignment_id)}
                                    >
                                        <td className="px-3 py-3 text-center cursor-pointer">
                                            <span className={`inline-block transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                                <ChevronRightIcon />
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                                            <div className="font-medium text-gray-900">{assignment.serial_number}</div>
                                            <div className="text-xs text-gray-500">{assignment.container_size_code || 'ไม่พบขนาด'}</div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-normal text-sm text-gray-700 break-words max-w-xs">{assignment.customer_name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatDate(assignment.assigned_date)}</td>
                                        {/* Expected Return Date Display */}
                                        <td className={`px-4 py-3 whitespace-nowrap text-sm ${overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                            {formatDate(assignment.expected_return_date)}
                                            {overdue && <span className="ml-1 text-xs">(เกินกำหนด)</span>}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                                            {assignment.returned_date ?
                                                <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-700">คืนแล้ว: {formatDate(assignment.returned_date)}</span> :
                                                <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-sky-100 text-sky-700">มอบหมายแล้ว</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-1">
                                            {!assignment.returned_date && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onOpenEditModal(assignment); }} // Call onOpenEditModal
                                                    className="text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-50 transition-colors duration-150"
                                                    title="แก้ไขรายละเอียดการมอบหมาย"
                                                >
                                                    <EditIcon />
                                                </button>
                                            )}
                                            {!assignment.returned_date && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onMarkAsReturned(assignment); }}
                                                    className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors duration-150"
                                                    title="บันทึกส่งคืน"
                                                >
                                                    <ReturnIcon />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className={`border-b border-gray-200 ${overdue && !assignment.returned_date ? 'bg-red-50' : 'bg-slate-50'}`}>
                                            <td />
                                            <td colSpan="6" className="px-6 py-4"> {/* Increased colSpan */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                                                    <DetailItem label="ID การมอบหมาย" value={assignment.assignment_id} />
                                                    <DetailItem label="ประเภทถังน้ำแข็ง" value={assignment.container_type} /> 
                                                    <DetailItem label="มอบหมายโดย" value={assignment.processed_by_username} />
                                                    <DetailItem label="มอบหมายเมื่อ" value={assignment.created_at} isDateTime={true} />
                                                    
                                                    {assignment.expected_return_date && (
                                                        <DetailItem label="วันที่คาดว่าจะคืน" value={assignment.expected_return_date} isDate={true} />
                                                    )}
                                                    {assignment.last_updated_at && ( // Assuming you might have updated_at for assignments
                                                        <DetailItem label="อัปเดทล่าสุด" value={assignment.updated_at || assignment.last_updated_at } isDateTime={true}/>
                                                    )}

                                                    <DetailItem label="หมายเหตุการมอบหมาย" value={assignment.notes} fullWidth={true}/>

                                                    {assignment.returned_date && (
                                                        <>
                                                            <DetailItem label="วันที่คืนจริง" value={assignment.returned_date} isDate={true} />
                                                            <DetailItem label="เหตุผลการคืน" value={assignment.return_reason_text || assignment.custom_return_reason} />
                                                            <DetailItem label="หมายเหตุการคืน" value={assignment.return_notes} fullWidth={true} />
                                                            {/* You might want to fetch and display who processed the return if that's tracked */}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
                <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 bg-white rounded-b-lg">
                    <div className="flex-1 flex justify-between sm:hidden">
                        <button
                            onClick={() => onPageChange(pagination.page - 1)}
                            disabled={pagination.page <= 1 || isLoading}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            ก่อนหน้า
                        </button>
                        <button
                            onClick={() => onPageChange(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages || isLoading}
                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            ถัดไป
                        </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700">
                                แสดง <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span>
                                {' '}ถึง <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.totalItems)}</span>
                                {' '}จาก <span className="font-medium">{pagination.totalItems}</span> รายการ
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => onPageChange(pagination.page - 1)}
                                    disabled={pagination.page <= 1 || isLoading}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    title="Previous"
                                >
                                    <span className="sr-only">ก่อนหน้า</span>
                                    <ChevronLeftPaginationIcon />
                                </button>
                                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                    หน้า {pagination.page} จาก {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => onPageChange(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.totalPages || isLoading}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    title="Next"
                                >
                                    <span className="sr-only">ถัดไป</span>
                                    <ChevronRightPaginationIcon />
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            )}
             {isLoading && assignments && assignments.length > 0 && (
                <div className="py-4 text-center text-sm text-gray-500">กำลังอัปเดตรายการ...</div>
            )}
        </div>
    );
};

export default ContainerAssignmentList;