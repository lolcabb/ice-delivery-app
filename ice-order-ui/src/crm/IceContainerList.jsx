// Suggested path: src/inventory/IceContainerList.jsx
import React from 'react';

// --- Icon Components (can be moved to a shared icons file or use a library) ---
const EditIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
);

const AssignIcon = () => ( // Icon for "Assign"
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
    </svg>
);

const RetireIcon = () => ( // Icon for "Retire" (could be a trash can or similar)
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
);

const ChevronLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
);

const ChevronRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
);
// --- End Icon Components ---

// Helper to format date
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString.split('T')[0] + 'T00:00:00');
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD, or choose preferred locale
};

const IceContainerList = ({
    containers,
    onEdit,
    onAssign, // Function to open assignment modal/form
    onRetire, // Function to retire a container
    isLoading,
    pagination, // { page, limit, totalItems, totalPages }
    onPageChange,
}) => {
    if (isLoading && (!containers || containers.length === 0)) {
        return (
            <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">กำลังโหลดถังน้ำแข็ง...</p>
            </div>
        );
    }

    if (!isLoading && (!containers || containers.length === 0)) {
        return (
            <div className="bg-white shadow rounded-lg p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">ไม่พบถังน้ำแข็ง</h3>
                <p className="mt-1 text-sm text-gray-500">
                    เริ่มต้นโดยการเพิ่มบันทึกถังน้ำแข็งใหม่
                </p>
            </div>
        );
    }

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'in stock': return 'bg-green-100 text-green-800';
            case 'with customer': return 'bg-blue-100 text-blue-800';
            case 'damaged': return 'bg-orange-100 text-orange-800';
            case 'maintenance': return 'bg-yellow-100 text-yellow-800';
            case 'retired': return 'bg-gray-100 text-gray-700 line-through';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getThaiContainerStatus = (status) => {
        if (!status) return 'ไม่มีข้อมูล'; // Or some other default for undefined/null status
        switch (status.toLowerCase()) {
            case 'in stock':
                return 'ในสต็อก';
            case 'with customer':
                return 'อยู่กับลูกค้า';
            case 'damaged':
                return 'ชำรุด';
            case 'maintenance':
                return 'ซ่อมบำรุง';
            case 'retired':
                return 'ปลดระวาง';
            default:
                return status; // Fallback to the original status if no translation is found
        }
    };

    return (
        <div className="bg-white shadow border-b border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมายเลขซีเรียล #</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ขนาด</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ประเภท</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ลูกค้าปัจจุบัน</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่ซื้อ</th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">การดำเนินการ</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {containers.map((container) => (
                            <tr key={container.container_id} className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{container.serial_number}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{container.size_code} ({container.capacity_liters}L)</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{container.container_type}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(container.status)}`}>
                                        {getThaiContainerStatus(container.status)}
                                    </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{container.current_customer_name_display || <span className="italic text-gray-400">ไม่มีข้อมูล</span>}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(container.purchase_date)}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                                    <button
                                        onClick={() => onEdit(container)}
                                        className="text-indigo-600 hover:text-indigo-800 transition-colors p-1 rounded hover:bg-indigo-50"
                                        title="แก้ไขรายละเอียดถังน้ำแข็ง"
                                    >
                                       <EditIcon />
                                    </button>
                                    {container.status === 'In Stock' && (
                                        <button
                                            onClick={() => onAssign(container)}
                                            className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded hover:bg-blue-50"
                                            title="มอบหมายให้ลูกค้า"
                                        >
                                            <AssignIcon />
                                        </button>
                                    )}
                                    {container.status !== 'Retired' && container.status !== 'With Customer' && (
                                        <button
                                            onClick={() => onRetire(container.container_id)}
                                            className="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50"
                                            title="ปลดระวางถังน้ำแข็ง"
                                        >
                                            <RetireIcon />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
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
                                แสดงผล <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span>
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
                                    <ChevronLeftIcon />
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
                                    <ChevronRightIcon />
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            )}
             {isLoading && containers && containers.length > 0 && (
                <div className="py-4 text-center text-sm text-gray-500">กำลังอัปเดตรายการ...</div>
            )}
        </div>
    );
};

export default IceContainerList;
