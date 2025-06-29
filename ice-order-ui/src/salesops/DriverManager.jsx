// src/salesops/DriverManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../apiService'; // Adjust path if needed
import DriverList from './DriverList';
import DriverForm from './DriverForm';

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

export default function DriverManager() {
    const [drivers, setDrivers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingDriver, setEditingDriver] = useState(null);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterActive, setFilterActive] = useState('true'); // Default to show active drivers

    const fetchDrivers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage('');
        try {
            const params = {};
            if (filterActive !== 'all') { // 'all' will not send the is_active param
                params.is_active = filterActive;
            }
            if (searchTerm) {
                params.search = searchTerm;
            }
            const data = await apiService.getDrivers(params);
            setDrivers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch drivers:", err);
            setError("Failed to load drivers. " + (err.data?.error || err.message));
            setDrivers([]);
             if (err.status === 401) {
                apiService.handleComponentAuthError(err); // Use the centralized handler
            }
        } finally {
            setIsLoading(false);
        }
    }, [searchTerm, filterActive]);

    useEffect(() => {
        fetchDrivers();
    }, [fetchDrivers]);

    const handleOpenFormModal = (driver = null) => {
        setEditingDriver(driver);
        setIsFormModalOpen(true);
        setError(null);
        setSuccessMessage('');
    };

    const handleCloseFormModal = () => {
        setEditingDriver(null);
        setIsFormModalOpen(false);
    };

    const handleSaveDriver = async (driverData) => {
        // Form will handle its internal loading state
        try {
            if (editingDriver && editingDriver.driver_id) {
                await apiService.updateDriver(editingDriver.driver_id, driverData);
                setSuccessMessage(`พนักงานขับรถ "${driverData.first_name}" อัปเดตสำเร็จ!`);
            } else {
                await apiService.addDriver(driverData);
                setSuccessMessage(`พนักงานขับรถ "${driverData.first_name}" ถูกเพิ่มสำเร็จ!`);
            }
            handleCloseFormModal();
            fetchDrivers(); // Refresh list
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err) {
            console.error("Error saving driver from manager:", err);
            setError("ไม่สามารถบันทึกพนักงานขับรถได้ " + (err.data?.error || err.message));
            throw err; // Re-throw for form to catch and display
        }
    };

    const handleDeactivateDriver = async (driverId, driverName) => {
        // Confirmation dialog is handled by the component calling this, e.g., DriverList
        setError(null);
        setSuccessMessage('');
        try {
            await apiService.deleteDriver(driverId); // This is a soft delete (sets is_active=false)
            setSuccessMessage(`พนักงานขับรถ "${driverName}" ถูกปิดใช้งานสำเร็จแล้ว`);
            fetchDrivers(); // Refresh list
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err) {
            console.error("Error deactivating driver:", err);
            setError("ไม่สามารถปิดใช้งานพนักงานขับรถได้ " + (err.data?.error || err.message));
        }
    };
    
    const handleActivateDriver = async (driverId, driverName) => {
        setError(null);
        setSuccessMessage('');
        try {
            // To activate, we PUT with is_active: true.
            // We might need to fetch the driver's current data first if PUT expects all fields.
            // For simplicity, assuming PUT /api/drivers/:id can update just 'is_active'.
            // If not, fetch driver, update is_active, then PUT.
            // Or ensure the DriverForm has an is_active toggle and use the edit flow.
            // For now, let's assume a specific endpoint or that PUT handles partial updates.
            // A common pattern is to use the existing update endpoint.
            const driverToUpdate = drivers.find(d => d.driver_id === driverId);
            if (driverToUpdate) {
                await apiService.updateDriver(driverId, { ...driverToUpdate, is_active: true });
                 setSuccessMessage(`Driver "${driverName}" activated successfully.`);
                 fetchDrivers();
                 setTimeout(() => setSuccessMessage(''), 4000);
            } else {
                setError("ไม่พบพนักงานขับรถสำหรับการเปิดใช้งาน");
            }
        } catch (err) {
            console.error("Error activating driver:", err);
            setError("ไม่สามารถเปิดใช้งานพนักงานขับรถได้ " + (err.data?.error || err.message));
        }
    };


    return (
        <div className="p-0 sm:p-2 lg:p-4">
            <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-3 border-b border-gray-200">
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-3 sm:mb-0">
                        จัดการคนขับรถ
                    </h2>
                    <button
                        onClick={() => handleOpenFormModal(null)}
                        className="w-full sm:w-auto px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-colors duration-150 flex items-center justify-center"
                    >
                        <PlusIcon />
                        เพิ่มพนักงานขับรถใหม่
                    </button>
                </div>

                {successMessage && (
                    <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-200 rounded-md text-sm shadow-sm">
                        {successMessage}
                    </div>
                )}
                {error && !isFormModalOpen && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-md text-sm shadow-sm">
                       {error}
                       <button onClick={fetchDrivers} className="ml-4 text-xs font-semibold underline">ลองอีกครั้ง</button>
                    </div>
                )}

                {/* Filters Section */}
                <div className="mb-6 p-3 -mx-3 sm:p-4 sm:-mx-4 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <label htmlFor="driver-search" className="block text-xs font-medium text-gray-600 mb-1">ค้นหา</label>
                            <input
                                type="text"
                                id="driver-search"
                                placeholder="ชื่อ, เบอร์โทรศัพท์, หมายเลขทะเบียน..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full input-field text-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="driver-status-filter" className="block text-xs font-medium text-gray-600 mb-1">สถานะ</label>
                            <select
                                id="driver-status-filter"
                                value={filterActive}
                                onChange={(e) => setFilterActive(e.target.value)}
                                className="w-full input-field text-sm"
                            >
                                <option value="true">ใช้งาน</option>
                                <option value="false">ไม่ใช้งาน</option>
                                <option value="all">ทั้งหมด</option>
                            </select>
                        </div>
                        {/* Apply filter button if needed, or filter on change via useEffect */}
                         <div className="pt-2 sm:pt-0">
                            <button
                                onClick={fetchDrivers} 
                                disabled={isLoading}
                                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 flex items-center justify-center"
                            >
                                {isLoading ? 'กำลังกรอง...' : 'ใช้ตัวกรอง'}
                            </button>
                        </div>
                    </div>
                </div>

                <DriverList
                    drivers={drivers}
                    isLoading={isLoading}
                    onEdit={handleOpenFormModal}
                    onDeactivate={handleDeactivateDriver}
                    onActivate={handleActivateDriver}
                />

                <DriverForm
                    isOpen={isFormModalOpen}
                    onClose={handleCloseFormModal}
                    onSave={handleSaveDriver}
                    driver={editingDriver}
                />
            </div>
            {/* Global styles for input-field if not defined elsewhere */}
            <style jsx global>{`
                .input-field {
                    display: block;
                    width: 100%;
                    padding-left: 0.75rem; 
                    padding-right: 0.75rem;
                    padding-top: 0.5rem; 
                    padding-bottom: 0.5rem;
                    border-width: 1px; 
                    border-color: #D1D5DB; /* Tailwind gray-300 */
                    border-radius: 0.375rem; /* Tailwind rounded-md */
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* Tailwind shadow-sm */
                    background-color: white;
                }
                select.input-field {
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
                    background-position: right 0.5rem center;
                    background-repeat: no-repeat;
                    background-size: 1.5em 1.5em;
                    padding-right: 2.5rem; 
                }
                .input-field:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                    border-color: #4f46e5; /* Tailwind indigo-600 */
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.3); /* ring-indigo-500/30 */
                }
                 .input-field:disabled { 
                    background-color: #f3f4f6; 
                    color: #6b7280; 
                    border-color: #e5e7eb; 
                    cursor: not-allowed;
                    opacity: 0.7;
                }
            `}</style>
        </div>
    );
}
