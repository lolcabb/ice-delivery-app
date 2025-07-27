import React from 'react';
import { Edit, Trash2, Wrench } from 'lucide-react';

const VehicleCard = ({ vehicle, onEdit, onDelete, onMaintenance }) => {
    const getStatusColor = (status) => {
        if (status === 'Active') return 'bg-green-100 text-green-800';
        if (status === 'In-Shop') return 'bg-yellow-100 text-yellow-800';
        if (status === 'Out of Service') return 'bg-red-100 text-red-800';
        return 'bg-gray-100 text-gray-800';
    };

    const getStatusText = (status) => {
        if (status === 'Active') return 'ใช้งาน';
        if (status === 'In-Shop') return 'ซ่อมบำรุง';
        if (status === 'Out of Service') return 'ไม่ใช้งาน';
        return status;
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="p-6">
                {/* Header with name and status */}
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                            {vehicle.vehicle_name}
                        </h3>
                        <p className="text-gray-600">{vehicle.license_plate}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                        {getStatusText(vehicle.status)}
                    </span>
                </div>
                
                {/* Vehicle details */}
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                        <span className="text-gray-500">ประเภท:</span>
                        <span className="text-gray-900">{vehicle.vehicle_type}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">ยี่ห้อ:</span>
                        <span className="text-gray-900">{vehicle.make}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">รุ่น:</span>
                        <span className="text-gray-900">{vehicle.model}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">ปี:</span>
                        <span className="text-gray-900">{vehicle.year}</span>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={() => onMaintenance(vehicle)}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg hover:bg-green-100 transition-colors"
                    >
                        <Wrench className="w-4 h-4" />
                        ซ่อมบำรุง
                    </button>
                    <button
                        onClick={() => onEdit(vehicle)}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                        <Edit className="w-4 h-4" />
                        แก้ไข
                    </button>
                    <button
                        onClick={() => onDelete(vehicle.vehicle_id)}
                        className="flex items-center justify-center bg-red-50 text-red-700 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors"
                        title="ลบข้อมูล"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VehicleCard;