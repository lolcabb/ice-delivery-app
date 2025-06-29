// Suggested path: src/expenses/ExpenseCategoryList.jsx
import React from 'react';

// Simple SVG Icons for actions (can be replaced with an icon library if you use one)
const EditIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
);

const DeactivateIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
);

const ActivateIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
);


const ExpenseCategoryList = ({ 
    categories, 
    onEdit, // Function to call when edit button is clicked, passes the category object
    onDeleteOrToggle, // Function to call when delete/toggle button is clicked, passes category_id
    isLoading 
}) => {
    // Display loading indicator if data is loading and there are no categories yet
    if (isLoading && (!categories || categories.length === 0)) {
        return (
            <div className="text-center py-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">กำลังโหลดหมวดหมู่...</p>
            </div>
        );
    }

    // Display message if there are no categories after loading
    if (!isLoading && (!categories || categories.length === 0)) {
        return (
            <div className="bg-white shadow rounded-lg p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">ไม่มีหมวดหมู่ค่าใช้จ่าย</h3>
                <p className="mt-1 text-sm text-gray-500">
                    เริ่มต้นโดยการเพิ่มหมวดหมู่ค่าใช้จ่ายใหม่
                </p>
            </div>
        );
    }

    return (
        <div className="shadow border-b border-gray-200 rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 bg-white">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ชื่อหมวดหมู่
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            รายละเอียด
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            สถานะ
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            การดำเนินการ
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {categories.map((category) => (
                        <tr key={category.category_id} className="hover:bg-gray-50 transition-colors duration-150 ease-in-out">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {category.category_name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs xl:max-w-md break-words">
                                {category.description || <span className="italic text-gray-400">ไม่มีคำอธิบาย</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    category.is_active 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                }`}>
                                    {category.is_active ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                <button
                                    onClick={() => onEdit(category)}
                                    className="text-indigo-600 hover:text-indigo-800 transition-colors p-1 rounded hover:bg-indigo-50"
                                    title="แก้ไขหมวดหมู่"
                                >
                                   <EditIcon />
                                </button>
                                <button
                                    onClick={() => onDeleteOrToggle(category.category_id)}
                                    className={`${
                                        category.is_active 
                                            ? 'text-red-500 hover:text-red-700 hover:bg-red-50' 
                                            : 'text-green-500 hover:text-green-700 hover:bg-green-50'
                                    } transition-colors p-1 rounded`}
                                    title={category.is_active ? 'ปิดการใช้งานหมวดหมู่' : 'เปิดใช้งานหมวดหมู่'}
                                >
                                    {category.is_active ? <DeactivateIcon /> : <ActivateIcon />}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {isLoading && categories.length > 0 && (
                <div className="py-4 text-center text-sm text-gray-500">กำลังอัปเดตรายการ...</div>
            )}
        </div>
    );
};

export default ExpenseCategoryList;
