// ice-delivery-app/ice-order-ui/src/crm/DeliveryRouteList.jsx
import React from 'react';
import { EditIcon, ToggleOnIcon, ToggleOffIcon } from '../components/Icons';

const DeliveryRouteList = ({ routes, onEdit, onToggleActive, isLoading }) => {
    if (isLoading && routes.length === 0) {
        return <div className="text-center p-8">กำลังโหลด...</div>;
    }

    if (!isLoading && routes.length === 0) {
        return <div className="text-center p-8 bg-white rounded-md shadow">ไม่พบสายการจัดส่ง</div>;
    }

    return (
        <div className="bg-white shadow border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อสาย</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">รายละเอียด</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">การดำเนินการ</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {routes.map((route) => (
                        <tr key={route.route_id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{route.route_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{route.route_description || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${route.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {route.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                <button onClick={() => onEdit(route)} className="p-1 text-indigo-600 hover:text-indigo-800" title="Edit Route">
                                    <EditIcon />
                                </button>
                                <button onClick={() => onToggleActive(route)} className={`p-1 ${route.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`} title={route.is_active ? 'Deactivate' : 'Activate'}>
                                    {route.is_active ? <ToggleOffIcon /> : <ToggleOnIcon />}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default DeliveryRouteList;