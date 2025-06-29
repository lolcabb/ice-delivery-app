// src/salesops/DriverList.jsx
import React from 'react';
// Define or import Icons
import { EditIcon, ToggleOnIcon, ToggleOffIcon } from '../components/Icons'; 

const DriverList = ({ drivers, isLoading, onEdit, onDeactivate, onActivate }) => {
    if (isLoading && drivers.length === 0) {
        return (
            <div className="text-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600 mx-auto"></div>
                <p className="mt-3 text-sm text-gray-500">กำลังโหลดพนักงานขับรถ...</p>
            </div>
        );
    }

    if (!isLoading && drivers.length === 0) {
        return (
            <div className="bg-gray-50 p-6 rounded-md text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <h3 className="mt-2 text-md font-medium text-gray-700">ไม่พบพนักงานขับรถ</h3>
                <p className="mt-1 text-sm text-gray-500">
                    ไม่มีพนักงานขับรถที่ตรงกับตัวกรองปัจจุบัน หรือยังไม่มีการเพิ่มพนักงานขับรถ
                </p>
            </div>
        );
    }

    const handleDeactivate = (driverId, driverName) => {
        if (window.confirm(`คุณแน่ใจหรือไม่ที่จะปิดใช้งานพนักงานขับรถ "${driverName}"? พวกเขาจะไม่สามารถถูกเลือกได้สำหรับการดำเนินการต่างๆ`)) {
            onDeactivate(driverId, driverName);
        }
    };
    
    const handleActivate = (driverId, driverName) => {
         if (window.confirm(`คุณแน่ใจหรือไม่ที่จะเปิดใช้งานพนักงานขับรถ "${driverName}"?`)) {
            onActivate(driverId, driverName);
        }
    };


    return (
        <div className="overflow-x-auto shadow border-b border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 bg-white">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อ</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมายเลขโทรศัพท์</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมายเลขทะเบียนรถ</th>
                        <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมายเหตุ</th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">การดำเนินการ</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {drivers.map((driver) => (
                        <tr key={driver.driver_id} className="hover:bg-gray-50 transition-colors text-sm">
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900 font-medium">
                                {driver.name} {/* Backend will ensure this is the full name */}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">{driver.phone_number || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">{driver.license_plate || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                                <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    driver.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                    {driver.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={driver.notes}>{driver.notes || <span className="italic text-gray-400">ไม่มี</span>}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-right space-x-1">
                                <button onClick={() => onEdit(driver)} className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors" title="แก้ไขพนักงานขับรถ">
                                    <EditIcon />
                                </button>
                                {driver.is_active ? (
                                    <button onClick={() => handleDeactivate(driver.driver_id, driver.name)} className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors" title="ปิดใช้งานพนักงานขับรถ">
                                        <ToggleOffIcon />
                                    </button>
                                ) : (
                                     <button onClick={() => handleActivate(driver.driver_id, driver.name)} className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors" title="เปิดใช้งานพนักงานขับรถ">
                                        <ToggleOnIcon />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {isLoading && drivers.length > 0 && (
                <div className="py-3 text-center text-xs text-gray-400">กำลังอัปเดตรายการ...</div>
            )}
        </div>
    );
};

export default DriverList;
