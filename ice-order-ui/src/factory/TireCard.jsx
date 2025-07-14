import React from 'react';
import { Edit, Trash2, MapPin, X, Package, Truck, AlertTriangle, CheckCircle } from 'lucide-react';

const TireCard = ({ tire, onEdit, onDelete, onAssign, onUnmount, assignment }) => {
    const getStatusColor = (status) => {
        if (status === 'In Stock') return 'bg-green-100 text-green-800 border-green-200';
        if (status === 'On Vehicle') return 'bg-blue-100 text-blue-800 border-blue-200';
        if (status === 'Retired') return 'bg-red-100 text-red-800 border-red-200';
        return 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const getStatusIcon = (status) => {
        if (status === 'In Stock') return <CheckCircle className="w-4 h-4" />;
        if (status === 'On Vehicle') return <Truck className="w-4 h-4" />;
        if (status === 'Retired') return <AlertTriangle className="w-4 h-4" />;
        return <Package className="w-4 h-4" />;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="p-6">
                {/* Header with serial number and status */}
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">{tire.serial_number}</h3>
                        <p className="text-gray-600">{tire.brand}</p>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(tire.status)}`}>
                        {getStatusIcon(tire.status)}
                        {tire.status}
                    </div>
                </div>
                
                {/* Tire details */}
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                        <span className="text-gray-500">เลข DOT:</span>
                        <span className="text-gray-900 font-mono">{tire.sidewall}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">วันที่จัดซื้อ:</span>
                        <span className="text-gray-900">{formatDate(tire.purchase_date)}</span>
                    </div>
                    
                    {/* Show assignment details if tire is on vehicle */}
                    {assignment && tire.status === 'On Vehicle' && (
                        <>
                            <div className="pt-2 border-t border-gray-200">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">รถ:</span>
                                    <span className="text-gray-900">{assignment.vehicle_name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">ตำแหน่ง:</span>
                                    <span className="text-gray-900">{assignment.position}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">วันที่ติดตั้ง:</span>
                                    <span className="text-gray-900">{formatDate(assignment.mount_date)}</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                    {tire.status === 'In Stock' && (
                        <button
                            onClick={() => onAssign(tire)}
                            className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                        >
                            <MapPin className="w-4 h-4" />
                            กำหนด
                        </button>
                    )}
                    
                    {tire.status === 'On Vehicle' && (
                        <button
                            onClick={() => onUnmount(tire)}
                            className="flex-1 flex items-center justify-center gap-2 bg-orange-50 text-orange-700 px-3 py-2 rounded-lg hover:bg-orange-100 transition-colors text-sm"
                        >
                            <X className="w-4 h-4" />
                            ถอดออก
                        </button>
                    )}
                    
                    <button
                        onClick={() => onEdit(tire)}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg hover:bg-green-100 transition-colors text-sm"
                    >
                        <Edit className="w-4 h-4" />
                        แก้ไข
                    </button>
                    
                    <button
                        onClick={() => onDelete(tire.tire_id)}
                        className="flex items-center justify-center bg-red-50 text-red-700 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors text-sm"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TireCard;