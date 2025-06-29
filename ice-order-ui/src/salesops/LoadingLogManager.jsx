// src/salesops/LoadingLogManager.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../apiService'; // Adjust path if needed
import LoadingLogList from './LoadingLogList';
import LoadingLogForm from './LoadingLogForm';
import { getCurrentLocalDateISO } from '../utils/dateUtils'; // For default date
import { PlusIcon, FilterIcon } from '../components/Icons'; // Assuming you'll have a shared Icons component or define it here


export default function LoadingLogManager() {
    const [groupedLoadingLogs, setGroupedLoadingLogs] = useState([]); 
    const [drivers, setDrivers] = useState([]); 
    const [products, setProducts] = useState([]); 
    const [deliveryRoutes, setDeliveryRoutes] = useState([]); 
    const [isLoading, setIsLoading] = useState(true); 
    const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true); 
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingBatch, setEditingBatch] = useState(null); // For editing a batch
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    const [filters, setFilters] = useState({
        driver_name: '',  //change from driver_id to driver_name for search
        date: getCurrentLocalDateISO(),
    });

    // state for debounced text input
    const [localDriverSearch, setLocalDriverSearch] = useState('');
    const debounceTimeoutRef = useRef(null);

    const fetchDropdownData = useCallback(async () => {
        setIsLoadingDropdowns(true);
        setError(null); 
        try {
            const driversData = await apiService.getDrivers({ is_active: true }); 
            setDrivers(Array.isArray(driversData) ? driversData : []);
            const productsData = await apiService.getSalesProducts();
            setProducts(Array.isArray(productsData) ? productsData : []);
            const routesData = await apiService.getDeliveryRoutes(); 
            setDeliveryRoutes(Array.isArray(routesData) ? routesData : []);
        } catch (err) {
            console.error("Failed to fetch dropdown data for loading logs:", err);
            setError("ไม่สามารถโหลดข้อมูลที่จำเป็นสำหรับฟอร์ม (พนักงานขับรถ/สินค้า/เส้นทาง) ได้ " + (err.data?.error || err.message));
        } finally {
            setIsLoadingDropdowns(false);
        }
    }, []);

    const groupLogs = (logs) => {
        if (!logs || logs.length === 0) return [];
        
        const grouped = logs.reduce((acc, log) => {
            // Use load_batch_uuid as the primary grouping key if it exists.
            // Fallback to the old composite key if load_batch_uuid is null (for older data perhaps, or if something went wrong)
            const groupKey = log.load_batch_uuid || `${log.driver_id}-${log.load_timestamp}-${log.load_type}`;
            
            if (!acc[groupKey]) {
                acc[groupKey] = {
                    batch_id: groupKey, // This is the key for the group, effectively the load_batch_uuid
                    driver_id: log.driver_id,
                    driver_name: log.driver_name,
                    load_timestamp: log.load_timestamp,
                    load_type: log.load_type,
                    route_id: log.route_id,
                    route_name: log.route_name,
                    area_manager_id: log.area_manager_id,
                    area_manager_name: log.area_manager_name,
                    notes: log.notes, // Common notes for the batch
                    items: [] 
                };
            }
            acc[groupKey].items.push({
                // loading_log_id: log.loading_log_id, // Individual log ID, if needed for item key
                product_id: log.product_id,
                product_name: log.product_name,
                quantity_loaded: log.quantity_loaded
                // any other item-specific fields from 'log' if they existed
            });
            return acc;
        }, {});

        return Object.values(grouped).sort((a,b) => new Date(b.load_timestamp) - new Date(a.load_timestamp)); // Sort batches by time
    };

    const fetchLoadingLogs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = {};
            if (filters.driver_name) params.driver_name = filters.driver_name;
            if (filters.date) params.date = filters.date;
            else { 
                setGroupedLoadingLogs([]); 
                setIsLoading(false);
                return;
            }
            const flatLogs = await apiService.getLoadingLogs(params);
            setGroupedLoadingLogs(groupLogs(Array.isArray(flatLogs) ? flatLogs : []));
        } catch (err) {
            console.error("Failed to fetch loading logs:", err);
            setError("โหลดบันทึกการขึ้นของไม่สำเร็จ" + (err.data?.error || err.message));
            setGroupedLoadingLogs([]);
             if (err.status === 401) {
                apiService.handleComponentAuthError(err);
            }
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchDropdownData();
    }, [fetchDropdownData]);

    useEffect(() => {
        if (filters.date) {
            fetchLoadingLogs();
        } else {
            setGroupedLoadingLogs([]);
        }
    }, [filters, fetchLoadingLogs]);

    // Debounced search for driver name
    useEffect(() => {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = setTimeout(() => {
            setFilters(prev => ({ ...prev, driver_name: localDriverSearch }));
        }, 300); // Adjust debounce time as needed

        return () => clearTimeout(debounceTimeoutRef.current);
    }, [localDriverSearch]);    

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        if (name === 'driver_name') {
            setLocalDriverSearch(value); // update local state immediately
        } else {
        setFilters(prev => ({ ...prev, [name]: value }));
        }
    };

    // handleApplyFilters is no longer strictly necessary as filters apply on change, but can be kept for an explicit button click
    const handleApplyFilters = () => {
        fetchLoadingLogs();
    };

    const handleOpenFormModal = (batchToEdit = null) => {
        if (isLoadingDropdowns) {
            setError("ข้อมูลดรอปดาวน์ยังคงโหลดอยู่ กรุณารอสักครู่");
            return;
        }
        if (drivers.length === 0 || products.length === 0) {
             setError("ไม่สามารถเปิดฟอร์มได้: ข้อมูลพนักงานขับรถหรือสินค้าขาดหายไป กรุณาตรวจสอบการตั้งค่าระบบหรือลองดึงข้อมูลอีกครั้ง");
             fetchDropdownData(); 
             return;
        }
        setEditingBatch(batchToEdit);
        setIsFormModalOpen(true);
        setError(null); 
        setSuccessMessage('');
    };

    const handleCloseFormModal = () => {
        setEditingBatch(null);
        setIsFormModalOpen(false);
    };

    const handleSaveLoadingLog = async (logDataPayload) => {
        try {
            if (editingBatch && editingBatch.batch_id) { 
                await apiService.updateLoadingLogBatch(editingBatch.batch_id, logDataPayload);
                setSuccessMessage('ชุดบันทึกการขึ้นของอัปเดตสำเร็จ!');
            } else { 
                await apiService.addLoadingLog(logDataPayload); 
                setSuccessMessage('สร้างบันทึกการขึ้นของสำเร็จ!');
            }
            handleCloseFormModal();
            fetchLoadingLogs(); 
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err) {
            console.error("Error saving loading log from manager:", err);
            setError("บันทึกการขึ้นของไม่สำเร็จ" + (err.data?.error || err.message));
            throw err; 
        }
    };

    return (
        <div className="p-0 sm:p-2 lg:p-4"> 
            <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-3 border-b border-gray-200">
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-3 sm:mb-0">
                        การจัดการบันทึกการขึ้นของ
                    </h2>
                    <button
                        onClick={() => handleOpenFormModal(null)} 
                        disabled={isLoadingDropdowns} 
                        className="w-full sm:w-auto px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-colors duration-150 flex items-center justify-center disabled:opacity-50"
                    >
                        <PlusIcon />
                        เพิ่มบันทึกการขึ้นของ
                    </button>
                </div>

                {successMessage && <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-200 rounded-md text-sm shadow-sm">{successMessage}</div>}
                {error && !isFormModalOpen && <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-md text-sm shadow-sm">{error}<button onClick={fetchLoadingLogs} className="ml-4 text-xs font-semibold underline">ลองบันทึกใหม่</button><button onClick={fetchDropdownData} className="ml-2 text-xs font-semibold underline">ลองดึงข้อมูลอีกครั้ง</button></div>}

                {/* --- UPDATED FILTER UI --- */}
                <div className="mb-6 p-3 -mx-3 sm:p-4 sm:-mx-4 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                        <div>
                            <label htmlFor="filter-date" className="block text-xs font-medium text-gray-600 mb-1">วันที่</label>
                            <input type="date" name="date" id="filter-date" value={filters.date} onChange={handleFilterChange} className="w-full input-field text-sm"/>
                        </div>
                        <div>
                            <label htmlFor="filter-driver_name" className="block text-xs font-medium text-gray-600 mb-1">ค้นหาชื่อพนักงานขับรถ</label>
                            <input type="text" name="driver_name" id="filter-driver_name" value={localDriverSearch} onChange={handleFilterChange} className="w-full input-field text-sm" placeholder="พิมพ์เพื่อค้นหา..."/>
                        </div>
                    </div>
                </div>

                <LoadingLogList 
                    groupedLogs={groupedLoadingLogs} 
                    isLoading={isLoading} 
                    onEditBatch={handleOpenFormModal} 
                />

                {isFormModalOpen && ( 
                    <LoadingLogForm
                        isOpen={isFormModalOpen}
                        onClose={handleCloseFormModal}
                        onSave={handleSaveLoadingLog}
                        drivers={drivers}
                        products={products}
                        deliveryRoutes={deliveryRoutes} 
                        isLoadingDropdowns={isLoadingDropdowns} 
                        editingBatch={editingBatch} 
                    />
                )}
            </div>
             <style jsx global>{`
                .input-field {
                    display: block;
                    width: 100%;
                    padding-left: 0.75rem; 
                    padding-right: 0.75rem;
                    padding-top: 0.5rem; 
                    padding-bottom: 0.5rem;
                    border-width: 1px; 
                    border-color: #D1D5DB; 
                    border-radius: 0.375rem; 
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); 
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
                input[type="date"].input-field {
                    padding-right: 0.75rem; 
                }
                .input-field:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                    border-color: #4f46e5; 
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.3); 
                }
                .input-field:disabled,
                .input-field.disabled\\:bg-gray-100:disabled { 
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
