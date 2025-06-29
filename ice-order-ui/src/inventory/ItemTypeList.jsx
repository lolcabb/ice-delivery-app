// Suggested path: src/inventory/ItemTypeList.jsx
import React from 'react';

// --- Icon Components (can be moved to a shared icons file or use a library) ---
const EditIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
);

const DeleteIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c1.153 0 2.24.032 3.287.094M5.116 5.79l-.004-.004M5.116 5.79l-.004-.004m0 0L4.695 4.503M18.884 5.79l.004-.004M18.884 5.79l.004-.004m0 0L19.305 4.503M12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
);
// --- End Icon Components ---

const ItemTypeList = ({
    itemTypes,
    onEdit, // Function to call when edit button is clicked, passes the itemType object
    onDelete, // Function to call when delete button is clicked, passes item_type_id
    isLoading
}) => {
    if (isLoading && (!itemTypes || itemTypes.length === 0)) {
        return (
            <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">กำลังโหลดประเภทวัสดุ...</p>
            </div>
        );
    }

    if (!isLoading && (!itemTypes || itemTypes.length === 0)) {
        return (
            <div className="bg-white shadow rounded-lg p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">ไม่พบประเภทวัสดุในคลัง</h3>
                <p className="mt-1 text-sm text-gray-500">
                    กำหนดประเภทวัสดุเช่น "บรรจุภัณฑ์" หรือ "เชือก" เพื่อจัดหมวดหมู่วัสดุในคงคลังของคุณ
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
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                ชื่อประเภท
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                รายละเอียด
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                การดำเนินการ
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {itemTypes.map((type) => (
                            <tr key={type.item_type_id} className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {type.type_name}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500 max-w-md break-words">
                                    {type.description || <span className="italic text-gray-400">ไม่มีรายละเอียด</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button
                                        onClick={() => onEdit(type)}
                                        className="text-indigo-600 hover:text-indigo-800 transition-colors p-1 rounded hover:bg-indigo-50"
                                        title="แก้ไขประเภทวัสดุ"
                                    >
                                       <EditIcon />
                                    </button>
                                    <button
                                        onClick={() => onDelete(type.item_type_id)}
                                        className="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50"
                                        title="ลบประเภทวัสดุ"
                                    >
                                        <DeleteIcon />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isLoading && itemTypes && itemTypes.length > 0 && (
                <div className="py-4 text-center text-sm text-gray-500">กำลังอัปเดตรายการ...</div>
            )}
        </div>
    );
};

export default ItemTypeList;
