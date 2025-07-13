import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '../apiService';

export default function TireStockManager() {
    const [tires, setTires] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTires = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiService.getVehicleTires ? await apiService.getVehicleTires() : [];
            setTires(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch tire stock:', err);
            setError(err.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTires();
    }, [fetchTires]);

    return (
        <div className="p-0 sm:p-2 lg:p-4">
            <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-4">Tire Stock</h2>
                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-md text-sm shadow-sm">
                        {error}
                    </div>
                )}
                {loading ? (
                    <div className="text-center py-6">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-2 text-gray-500">Loading tires...</p>
                    </div>
                ) : tires.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">No tire stock.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {tires.map((tire) => (
                                    <tr key={tire.tire_id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{tire.brand}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tire.size}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{tire.quantity}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}