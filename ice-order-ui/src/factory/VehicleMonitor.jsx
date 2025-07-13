import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '../apiService';

export default function VehicleMonitor() {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchVehicles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiService.getVehicles ? await apiService.getVehicles() : [];
            setVehicles(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch vehicles:', err);
            setError(err.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVehicles();
    }, [fetchVehicles]);

    return (
        <div className="p-0 sm:p-2 lg:p-4">
            <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
                <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-200">
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-700">Vehicle Monitor</h2>
                </div>
                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-md text-sm shadow-sm">
                        {error}
                    </div>
                )}
                {loading ? (
                    <div className="text-center py-6">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-2 text-gray-500">Loading vehicles...</p>
                    </div>
                ) : vehicles.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">No vehicles found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kilometers</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Maintenance</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fuel (L)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {vehicles.map((v) => (
                                    <tr key={v.vehicle_id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{v.name || v.license_plate}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{v.vehicle_type}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{v.mileage_km}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{v.last_maintenance_date}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{v.fuel_usage_liters}</td>
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