// src/crm/IceContainerManager.jsx 
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../apiService'; 
import IceContainerList from './IceContainerList'; 
import IceContainerForm from './IceContainerForm'; 
import AssignContainerForm from './AssignContainerForm'; 

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

// --- Step 1: Extract FilterControls into a separate, memoized component ---
const FilterControls = React.memo(({ filters, localSerialNumber, containerSizes, onFilterChange, onApplyFilters, isLoading }) => {
    return (
        <div className="mb-6 p-4 bg-white shadow rounded-lg">
            <h3 className="text-md font-semibold text-gray-700 mb-3">กรองข้อมูลถังน้ำแข็ง</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <input
                    type="text"
                    name="serial_number"
                    value={localSerialNumber} // Bind to local state
                    onChange={onFilterChange}
                    placeholder="ค้นหาหมายเลขซีเรียล #"
                    className="input-field"
                />
                <select name="size_id" value={filters.size_id} onChange={onFilterChange} className="input-field">
                    <option value="">ทั้งหมด</option>
                    {containerSizes.map(s => <option key={s.size_id} value={s.size_id}>{s.size_code} ({s.description || `${s.capacity_liters}L`})</option>)}
                </select>
                <select name="container_type" value={filters.container_type} onChange={onFilterChange} className="input-field">
                    <option value="">ทั้งหมด (CRM/ให้ยืม)</option>
                    <option value="CRM">CRM</option>
                    <option value="Loaner">ให้ยืม</option>
                </select>
                <select name="status" value={filters.status} onChange={onFilterChange} className="input-field">
                    <option value="">ทั้งหมด</option>
                    <option value="In Stock">มีสินค้า</option>
                    <option value="With Customer">อยู่กับลูกค้า</option>
                    <option value="Damaged">เสียหาย</option>
                    <option value="Maintenance">กำลังซ่อมบำรุง</option>
                    <option value="Retired">ปลดระวาง</option>
                </select>
                <div className="lg:col-span-full flex justify-start mt-2">
                    <button onClick={onApplyFilters} disabled={isLoading} className="btn-primary">
                        {isLoading ? 'กำลังกรอง...' : 'ใช้ตัวกรอง'}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default function IceContainerManager() {
    const [containers, setContainers] = useState([]);
    const [containerSizes, setContainerSizes] = useState([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false); // For Add/Edit Container
    const [editingContainer, setEditingContainer] = useState(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false); // For Assign Container
    const [containerToAssign, setContainerToAssign] = useState(null);

    const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, totalItems: 0 });
    const [filters, setFilters] = useState({
        serial_number: '',
        size_id: '',
        container_type: '', 
        status: ''
    });

    // --- Step 2: Add local state for debounced input ---
    const [localSerialNumber, setLocalSerialNumber] = useState('');
    const debounceTimeoutRef = useRef(null);

    const fetchIceContainers = useCallback(async (pageArg, filtersArg) => {
        //use arguments if provided, otherwise fallback to current state values
        const pageToFetch = pageArg !== undefined ? pageArg : pagination.page;
        const currentFilters = filtersArg !== undefined ? filtersArg : filters;

        console.log(`Fetching ice containers - Page: ${pageToFetch}, Filters:`, currentFilters, `Limit: ${pagination.limit}`);
        setIsLoading(true);
        setError(null);
        try {
            const params = { ...currentFilters, page: pageToFetch, limit: pagination.limit };
            Object.keys(params).forEach(key => { 
                if (params[key] === '' || params[key] === null || params[key] === undefined) {
                    delete params[key];
                }
            });
            const response = await apiService.getIceContainers(params); 
            setContainers(Array.isArray(response.data) ? response.data : []);
            // Preserve existing limit if not in response pagination
            setPagination(prevPagination => ({
                ...prevPagination,
                ...(response.pagination || {page: 1, totalPages: 1, totalItems: 0}),
            }));
        } catch (err) {
            console.error("Failed to fetch ice containers:", err);
            setError(err.data?.error || err.message || 'ไม่สามรถโหลดถังน้ำแข็งได้.');
            if (err.status === 401) apiService.handleComponentAuthError(err, () => window.location.replace('/login'));
        } finally {
            setIsLoading(false);
        }
    // Add all reactive values from the component scope that are used inside the callback
    // State setters (setIsLoading, setError, etc.) are stable and usually don't need to be listed,
    // but including them satisfies the strictest interpretation of exhaustive-deps.
    // apiService is an import, so it's stable.
    }, [
        pagination.page, // Used as fallback for pageArg
        pagination.limit, // Used directly for params.limit
        filters // Used as fallback for filtersArg
        // Stable state setters (optional but good for explicitness if ESLint complains):
        // setIsLoading, setError, setContainers, setPagination 
    ]); 

    // CORRECTED useCallback for fetchContainerSizesForForm
    const fetchContainerSizesForForm = useCallback(async () => { 
        if (containerSizes.length === 0 || isFormModalOpen || isAssignModalOpen) { // Fetch if needed for any modal
            try {
                const sizesData = await apiService.getContainerSizes(); 
                setContainerSizes(Array.isArray(sizesData) ? sizesData.filter(s => s.is_active !== false) : []);
            } catch (err) {
                console.error("Failed to fetch container sizes for form:", err);
                setError(prev => prev || "ไม่สามารถโหลดขนาดถังน้ำแข็งได้.");
            }
        }
    // Dependencies are values from scope used inside.
    // apiService is stable. setContainerSizes and setError are stable state setters.
    }, [containerSizes.length, isFormModalOpen, isAssignModalOpen, setContainerSizes, setError]);

    // --- Step 3: Add debouncing useEffect ---
    useEffect(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(() => {
            setPagination(prev => ({ ...prev, page: 1 }));
            setFilters(prev => ({ ...prev, serial_number: localSerialNumber }));
        }, 500);

        return () => clearTimeout(debounceTimeoutRef.current);
    }, [localSerialNumber]);

    useEffect(() => {
        fetchContainerSizesForForm(); 
    }, [fetchContainerSizesForForm]); 
    
    useEffect(() => {
        fetchIceContainers(pagination.page, filters);
    }, [pagination.page, filters, fetchIceContainers]);


    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const handleFilterChange = useCallback((e) => {
        const { name, value } = e.target;
        if (name === 'serial_number') {
            setLocalSerialNumber(value);
        } else {
            setFilters(prev => ({ ...prev, [name]: value }));
            setPagination(prev => ({ ...prev, page: 1 }));
        }
    }, []);

    const applyFilters = useCallback(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    // For Add/Edit Container Form
    const handleOpenFormModal = useCallback((container = null) => {
        if (containerSizes.length === 0) {
            fetchContainerSizesForForm(); 
        }
        setEditingContainer(container);
        setIsFormModalOpen(true);
        setSuccessMessage(''); setError(null);
    }, [containerSizes.length, fetchContainerSizesForForm]);

    const handleCloseFormModal = useCallback(() => {
        setIsFormModalOpen(false);
        setEditingContainer(null);
    }, []);

    const handleSaveContainer = useCallback(async (formDataFromForm) => {
        let opError = null;
        try {
            const payload = { ...formDataFromForm }; 
            if (editingContainer && editingContainer.container_id) {
                await apiService.updateIceContainer(editingContainer.container_id, payload);
                setSuccessMessage(`อัปเดตถังน้ำแข็ง "${payload.serial_number}" สำเร็จ.`);
            } else {
                await apiService.addIceContainer(payload);
                setSuccessMessage(`เพิ่มถังน้ำแข็ง "${payload.serial_number}" สำเร็จ.`);
            }
            handleCloseFormModal();
            await fetchIceContainers(editingContainer ? pagination.page : 1, filters);
        } catch (err) {
            console.error("Error saving container in Manager:", err);
            opError = err.message || "บันทึกถังน้ำแข็งล้มเหลว.";
            throw new Error(opError); 
        } finally {
             if (!opError) setTimeout(() => setSuccessMessage(''), 4000);
        }
    }, [editingContainer, pagination.page, filters, fetchIceContainers, handleCloseFormModal]);

    // For Assign Container Form
    const handleOpenAssignModal = useCallback((container) => {
        setContainerToAssign(container);
        setIsAssignModalOpen(true);
        setSuccessMessage(''); setError(null);
    }, []);

    const handleCloseAssignModal = useCallback(() => {
        setIsAssignModalOpen(false);
        setContainerToAssign(null);
    }, []);

    const handleConfirmAssignment = useCallback(async (containerId, assignmentData) => {
        let opError = null;
        try {
            await apiService.assignIceContainer(containerId, assignmentData);
            setSuccessMessage(`มอบหมายถังน้ำแข็งสำเร็จ.`);
            handleCloseAssignModal();
            await fetchIceContainers(pagination.page, filters); // Refresh the list to show updated status
        } catch (err) {
            console.error("Error assigning container:", err);
            opError = err.data?.error || err.message || "มอบหมายถังน้ำแข็งล้มเหลว.";
            throw new Error(opError); // Let AssignContainerForm display this error
        } finally {
            if (!opError) setTimeout(() => setSuccessMessage(''), 4000);
        }
    }, [pagination.page, filters, fetchIceContainers, handleCloseAssignModal]);

    const handleRetireContainer = useCallback(async (containerId) => {
        const containerToRetire = containers.find(c => c.container_id === containerId);
        if (!containerToRetire) return;

        const confirmRetire = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการปลดระวางถังน้ำแข็ง "${containerToRetire.serial_number}"? การกระทำนี้จะตั้งสถานะเป็น 'ปลดระวาง'.`);
        if (confirmRetire) {
            setIsLoading(true); setError(null); setSuccessMessage('');
            try {
                await apiService.retireIceContainer(containerId);
                setSuccessMessage(`ปลดระวางถังน้ำแข็ง "${containerToRetire.serial_number}" สำเร็จ.`);
                await fetchIceContainers(pagination.page, filters);
            } catch (err) {
                console.error("Failed to retire container:", err);
                setError(err.data?.error || err.message || "ไม่สามารถปลดระวางถังน้ำแข็งได้.");
                if (err.status === 401) apiService.handleComponentAuthError(err, () => window.location.replace('/login'));
            } finally {
                setIsLoading(false);
                setTimeout(() => setSuccessMessage(''), 4000);
            }
        }
    }, [containers, pagination.page, filters, fetchIceContainers]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-[calc(100vh-theme(space.32))] rounded-lg shadow">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-3 border-b border-gray-300">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-0">
                        จัดการถังน้ำแข็ง
                    </h1>
                    <button
                        onClick={() => handleOpenFormModal(null)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150 flex items-center justify-center"
                    >
                        <PlusIcon />
                        เพิ่มถังน้ำแข็งใหม่
                    </button>
                </div>

                {successMessage && (
                    <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded-md text-sm shadow">
                        {successMessage}
                    </div>
                )}
                {error && !isFormModalOpen && !isAssignModalOpen && ( // Hide global error if any modal is open
                    <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm shadow">
                        <strong>Error:</strong> {error}
                        <button onClick={() => fetchIceContainers(pagination.page, filters)} className="ml-4 px-3 py-1 text-xs bg-red-200 hover:bg-red-300 rounded-md font-semibold">ลองใหม่</button>
                    </div>
                )}

                <FilterControls
                    filters={filters}
                    localSerialNumber={localSerialNumber}
                    containerSizes={containerSizes}
                    onFilterChange={handleFilterChange}
                    onApplyFilters={applyFilters}
                    isLoading={isLoading}
                />

                <IceContainerList
                    containers={containers}
                    onEdit={handleOpenFormModal}
                    onAssign={handleOpenAssignModal} 
                    onRetire={handleRetireContainer}
                    isLoading={isLoading}
                    pagination={pagination}
                    onPageChange={handlePageChange}
                />

                <IceContainerForm
                    isOpen={isFormModalOpen}
                    onClose={handleCloseFormModal}
                    onSave={handleSaveContainer}
                    container={editingContainer}
                    containerSizes={containerSizes}
                />

                <AssignContainerForm
                    isOpen={isAssignModalOpen}
                    onClose={handleCloseAssignModal}
                    onSave={handleConfirmAssignment} // Pass the new handler
                    container={containerToAssign} // Pass the container to be assigned
                />
            </div>
             <style jsx global>{`
                .input-field {
                    display: block;
                    width: 100%;
                    padding-left: 0.75rem; padding-right: 0.75rem;
                    padding-top: 0.5rem; padding-bottom: 0.5rem;
                    border-width: 1px; border-color: #D1D5DB; /* border-gray-300 */
                    border-radius: 0.375rem; /* rounded-md */
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
                }
                .input-field:focus {
                    outline: 2px solid transparent; outline-offset: 2px;
                    border-color: #6366F1; /* focus:border-indigo-500 */
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5); 
                }
                .btn-primary { 
                    background-color: #4f46e5; 
                    color: white;
                    padding: 0.625rem 1.25rem; 
                    font-weight: 500; 
                    font-size: 0.875rem; 
                    border-radius: 0.5rem; 
                    box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06); 
                }
                .btn-primary:hover {
                    background-color: #4338ca; 
                }
                .btn-primary:disabled {
                    opacity: 0.5;
                }
            `}</style>
        </div>
    );
}
