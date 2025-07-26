// src/crm/ContainerAssignmentManager.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    getAllAssignments,
    getReturnReasons,
    getIceContainers,
    returnIceContainer,
    assignIceContainer,
    updateAssignmentDetails,
} from '../api/containers.js';
import { handleComponentAuthError } from '../api/helpers.js';
import ContainerAssignmentList from './ContainerAssignmentList';
import ReturnContainerForm from './ReturnContainerForm';
import CreateAssignmentModal from './CreateAssignmentModal';
import EditAssignmentForm from './EditAssignmentForm';

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);
const Spinner = () => <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-600 mx-auto"></div>;

// --- Step 1: Extract FilterControls into a separate, memoized component ---
const FilterControls = React.memo(({ filters, localFilters, onFilterChange, onApplyFilters, isLoading }) => {
    return (
        <div className="mb-6 p-4 bg-white shadow rounded-lg">
            <h3 className="text-md font-semibold text-gray-700 mb-3">กรองการมอบหมาย</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div>
                    <label htmlFor="customer_name_search" className="block text-xs font-medium text-gray-500">ชื่อลูกค้า</label>
                    <input
                        type="text"
                        name="customer_name_search"
                        value={localFilters.customer_name_search} // Bind to local state
                        onChange={onFilterChange}
                        placeholder="ค้นหาชื่อลูกค้า"
                        className="input-field"
                    />
                </div>
                <div>
                    <label htmlFor="serial_number" className="block text-xs font-medium text-gray-500">หมายเลขถังน้ำแข็ง</label>
                    <input
                        type="text"
                        name="serial_number"
                        value={localFilters.serial_number} // Bind to local state
                        onChange={onFilterChange}
                        placeholder="ค้นหาหมายเลขถังน้ำแข็ง"
                        className="input-field"
                    />
                </div>
                <div>
                    <label htmlFor="returned_status" className="block text-xs font-medium text-gray-500">สถานะ</label>
                    <select name="returned_status" value={filters.returned_status} onChange={onFilterChange} className="input-field">
                        <option value="all">ทั้งหมด</option>
                        <option value="not_returned">กำลังมอบหมาย</option>
                        <option value="returned">คืนแล้ว</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="assigned_date_start" className="block text-xs font-medium text-gray-500">วันที่มอบหมาย จาก</label>
                    <input type="date" name="assigned_date_start" value={filters.assigned_date_start} onChange={onFilterChange} className="input-field"/>
                </div>
                <div>
                    <label htmlFor="assigned_date_end" className="block text-xs font-medium text-gray-500">วันที่มอบหมาย ถึง</label>
                    <input type="date" name="assigned_date_end" value={filters.assigned_date_end} onChange={onFilterChange} className="input-field"/>
                </div>
                <div>
                    <label htmlFor="expected_return_date_start" className="block text-xs font-medium text-gray-500">วันที่คาดว่าจะคืน จาก</label>
                    <input type="date" name="expected_return_date_start" value={filters.expected_return_date_start} onChange={onFilterChange} className="input-field"/>
                </div>
                <div>
                    <label htmlFor="expected_return_date_end" className="block text-xs font-medium text-gray-500">วันที่คาดว่าจะคืน ถึง</label>
                    <input type="date" name="expected_return_date_end" value={filters.expected_return_date_end} onChange={onFilterChange} className="input-field"/>
                </div>
                <div className="flex items-end md:col-start-1 lg:col-start-auto">
                    <button onClick={onApplyFilters} disabled={isLoading} className="btn-primary w-full sm:w-auto">
                        {isLoading ? 'กำลังกรอง...' : 'ใช้ตัวกรอง'}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default function ContainerAssignmentManager() {
    const [assignments, setAssignments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    const [pagination, setPagination] = useState({ page: 1, limit: 15, totalPages: 1, totalItems: 0 });
    const [filters, setFilters] = useState({
        customer_name_search: '',
        serial_number: '',
        assigned_date_start: '',
        assigned_date_end: '', // Kept this filter
        expected_return_date_start: '', // New
        expected_return_date_end: '',   // New
        returned_status: 'not_returned',
    });

    // --- Step 2: Add local state for debounced inputs ---
    const [localFilters, setLocalFilters] = useState({
        customer_name_search: '',
        serial_number: ''
    });
    const debounceTimeoutRef = useRef(null);

    const [expandedAssignmentId, setExpandedAssignmentId] = useState(null);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [selectedAssignmentForReturn, setSelectedAssignmentForReturn] = useState(null);
    const [returnReasons, setReturnReasons] = useState([]);
    const [isCreateAssignmentModalOpen, setIsCreateAssignmentModalOpen] = useState(false);
    const [availableContainers, setAvailableContainers] = useState([]);
    const [isEditAssignmentModalOpen, setIsEditAssignmentModalOpen] = useState(false);
    const [selectedAssignmentForEdit, setSelectedAssignmentForEdit] = useState(null);

    const fetchAssignments = useCallback(async (pageArg, filtersArg) => {
        const pageToFetch = pageArg !== undefined ? pageArg : pagination.page;
        const currentFilters = filtersArg !== undefined ? filtersArg : filters;

        setIsLoading(true);
        setError(null);
        try {
            const params = { ...currentFilters, page: pageToFetch, limit: pagination.limit };
            Object.keys(params).forEach(key => {
                if (params[key] === '' || params[key] === null || params[key] === undefined) {
                    delete params[key];
                }
            });
            const response = await getAllAssignments(params);
            const assignmentsData = Array.isArray(response.data?.data) ? response.data.data : [];
            setAssignments(assignmentsData);
            setPagination(prevPagination => ({
                ...prevPagination,
                ...(response.data?.pagination || { page: 1, totalPages: 1, totalItems: 0 })
            }));
        } catch (err) {
            console.error("Failed to fetch assignments:", err);
            setError(err.data?.error || err.message || 'ไม่สามารถโหลดการมอบหมายได้');
            if (err.status === 401) handleComponentAuthError(err, () => window.location.replace('/login'));
        } finally {
            setIsLoading(false);
        }
    }, [pagination.limit, pagination.page, filters]);

    // --- Step 3: Add debouncing useEffect ---
    useEffect(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(() => {
            setPagination(prev => ({ ...prev, page: 1 }));
            setFilters(prev => ({
                ...prev,
                customer_name_search: localFilters.customer_name_search,
                serial_number: localFilters.serial_number
            }));
        }, 500);

        return () => clearTimeout(debounceTimeoutRef.current);
    }, [localFilters.customer_name_search, localFilters.serial_number]);

    useEffect(() => {
        fetchAssignments(pagination.page, filters);
    }, [fetchAssignments, pagination.page, filters]);

    const fetchReturnReasons = useCallback(async () => {
        if (returnReasons.length === 0 || isReturnModalOpen) {
            try {
                const data = await getReturnReasons();
                setReturnReasons(Array.isArray(data) ? data.filter(r => r.is_active !== false) : []);
            } catch (err) {
                console.error("Failed to fetch return reasons:", err);
                setError(prev => prev || "ไม่สามารถโหลดเหตุผลการคืนสำหรับฟอร์มได้");
            }
        }
    }, [returnReasons.length, isReturnModalOpen]);

    const fetchPrerequisitesForNewAssignment = useCallback(async () => {
        //setIsLoading(true); // Consider local loading state for this action if preferred
        //setError(null);

        try {
            const containerParams = { status: 'In Stock', limit: 1000 };
            const containerResponse = await getIceContainers(containerParams);
            const activeContainers = Array.isArray(containerResponse.data?.data) ? containerResponse.data.data : [];
            setAvailableContainers(activeContainers);
            if (activeContainers.length === 0) {
                setError("ไม่มีถังน้ำแข็ง 'ในสต็อก' สำหรับการมอบหมายใหม่");
                return false;
            }
            return true;
        } catch (fetchErr) {
            console.error("Error preparing for new assignment:", fetchErr);
            setError(fetchErr.data?.error || fetchErr.message || "ไม่สามารถโหลดข้อมูลที่จำเป็นสำหรับการมอบหมายใหม่ได้");
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAssignments(pagination.page, filters);
    }, [fetchAssignments, pagination.page, filters]);

    useEffect(() => {
        if (isReturnModalOpen) {
            fetchReturnReasons();
        }
    }, [isReturnModalOpen, fetchReturnReasons]);
    
    useEffect(() => {
        let timer;
        if (successMessage) {
            timer = setTimeout(() => setSuccessMessage(''), 4000);
        }
        return () => clearTimeout(timer);
    }, [successMessage]);

    const handleFilterChange = useCallback((e) => {
        const { name, value } = e.target;
        if (name === 'customer_name_search' || name === 'serial_number') {
            setLocalFilters(prev => ({ ...prev, [name]: value }));
        } else {
            setFilters(prev => ({ ...prev, [name]: value }));
            setPagination(prev => ({ ...prev, page: 1 }));
        }
    }, []);

    const applyFilters = useCallback(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const handleToggleExpandDetails = useCallback((assignmentId) => {
        setExpandedAssignmentId(prevId => (prevId === assignmentId ? null : assignmentId));
    }, []);

    const handleOpenReturnModal = useCallback((assignment) => {
        setSelectedAssignmentForReturn(assignment);
        setIsReturnModalOpen(true);
        setSuccessMessage(''); setError(null);
    }, []);

    const handleCloseReturnModal = useCallback(() => {
        setIsReturnModalOpen(false);
        setSelectedAssignmentForReturn(null);
    }, []);

    const handleConfirmReturn = useCallback(async (assignmentId, returnData) => {
        setIsLoading(true); setError(null); setSuccessMessage('');
        try {
            await returnIceContainer(assignmentId, returnData);
            setSuccessMessage(`ดำเนินการคืนถังน้ำแข็งสำหรับการมอบหมาย #${assignmentId} สำเร็จแล้ว`);
            handleCloseReturnModal();
            fetchAssignments(pagination.page, filters);
        } catch (err) {
            console.error("Error processing return:", err);
            setError(err.data?.error || err.message || "ดำเนินการคืนถังน้ำแข็งไม่สำเร็จ");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [handleCloseReturnModal, fetchAssignments, pagination.page, filters]);  

    const handleOpenCreateAssignmentModal = useCallback(async () => {
        setIsLoading(true); // Indicate loading for prerequisites
        const prerequisitesMet = await fetchPrerequisitesForNewAssignment();
        setIsLoading(false); // Reset loading state after fetching prerequisites
        if (prerequisitesMet) {
            setIsCreateAssignmentModalOpen(true);
            setSuccessMessage(''); setError(null);
        }
    }, [fetchPrerequisitesForNewAssignment]);

    const handleCloseCreateAssignmentModal = useCallback(() => {
        setIsCreateAssignmentModalOpen(false);
    }, []);

    const handleConfirmCreateAssignment = useCallback(async (newAssignmentData) => {
        setIsLoading(true); setError(null); setSuccessMessage('');
        try {
            await assignIceContainer(newAssignmentData.container_id, {
                customer_id: newAssignmentData.customer_id,
                assigned_date: newAssignmentData.assigned_date,
                expected_return_date: newAssignmentData.expected_return_date,
                notes: newAssignmentData.notes,
            });
            setSuccessMessage('สร้างการมอบหมายถังน้ำแข็งใหม่สำเร็จแล้ว');
            handleCloseCreateAssignmentModal();
            fetchAssignments(1, filters);
        } catch (err) {
            console.error("Error creating new assignment:", err);
            setError(err.data?.error || err.message || "สร้างการมอบหมายถังน้ำแข็งใหม่ไม่สำเร็จ");
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [handleCloseCreateAssignmentModal, fetchAssignments, filters]);

    const handleOpenEditAssignmentModal = useCallback((assignment) => {
        setSelectedAssignmentForEdit(assignment);
        setIsEditAssignmentModalOpen(true);
        setSuccessMessage(''); setError(null);
    }, []);

    const handleCloseEditAssignmentModal = useCallback(() => {
        setIsEditAssignmentModalOpen(false);
        setSelectedAssignmentForEdit(null);
    }, []);

    const handleConfirmEditAssignment = useCallback(async (assignmentId, editedData) => {
        setIsLoading(true); setError(null); setSuccessMessage('');
        try {
            await updateAssignmentDetails(assignmentId, editedData);
            setSuccessMessage(`อัปเดตการมอบหมาย #${assignmentId} สำเร็จแล้ว`);
            handleCloseEditAssignmentModal();
            fetchAssignments(pagination.page, filters); // Refresh list
        } catch (err) {
            console.error("Error updating assignment:", err);
            setError(err.data?.error || err.message || "อัปเดตการมอบหมายไม่สำเร็จ");
            throw err; // Re-throw for the form to handle its own error display if needed
        } finally {
            setIsLoading(false);
        }
    }, [handleCloseEditAssignmentModal, fetchAssignments, pagination.page, filters]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-[calc(100vh-theme(space.32))] rounded-lg shadow">
            <div className="max-w-full mx-auto"> {/* Changed to max-w-full for more space for filters */}
                 <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-3 border-b border-gray-300">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-0">
                        การมอบหมายถังน้ำแข็ง
                    </h1>
                    <button
                        onClick={handleOpenCreateAssignmentModal}
                        className="w-full sm:w-auto px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150 flex items-center justify-center"
                        disabled={isLoading}
                    >
                        <PlusIcon />
                        มอบหมายถังน้ำแข็งใหม่
                    </button>
                </div>

                {successMessage && (
                    <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded-md text-sm shadow">
                        {successMessage}
                    </div>
                )}
                {error && !isReturnModalOpen && !isCreateAssignmentModalOpen && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm shadow">
                        <strong>ข้อผิดพลาด:</strong> {error}
                        <button onClick={() => fetchAssignments(pagination.page, filters)} className="ml-4 px-3 py-1 text-xs bg-red-200 hover:bg-red-300 rounded-md font-semibold">Retry</button>
                    </div>
                )}

                <FilterControls
                    filters={filters}
                    localFilters={localFilters}
                    onFilterChange={handleFilterChange}
                    onApplyFilters={applyFilters}
                    isLoading={isLoading}
                />
                
                {isLoading && assignments.length === 0 ? (
                    <div className="text-center py-10"><Spinner /> <p className="mt-2 text-gray-500">กำลังโหลดการมอบหมาย...</p></div>
                ) : (
                    <ContainerAssignmentList
                        assignments={assignments}
                        isLoading={isLoading}
                        pagination={pagination}
                        onPageChange={handlePageChange}
                        onMarkAsReturned={handleOpenReturnModal}
                        onOpenEditModal={handleOpenEditAssignmentModal}
                        expandedAssignmentId={expandedAssignmentId}
                        onToggleExpandDetails={handleToggleExpandDetails}
                    />
                )}

                {selectedAssignmentForReturn && (
                    <ReturnContainerForm
                        isOpen={isReturnModalOpen}
                        onClose={handleCloseReturnModal}
                        onSaveReturn={handleConfirmReturn}
                        assignment={selectedAssignmentForReturn}
                        returnReasons={returnReasons}
                    />
                )}
                
                <CreateAssignmentModal
                    isOpen={isCreateAssignmentModalOpen}
                    onClose={handleCloseCreateAssignmentModal}
                    onSave={handleConfirmCreateAssignment}
                    availableContainers={availableContainers}
                />

                {selectedAssignmentForEdit && (
                    <EditAssignmentForm
                        isOpen={isEditAssignmentModalOpen}
                        onClose={handleCloseEditAssignmentModal}
                        onSaveEdit={handleConfirmEditAssignment}
                        assignmentToEdit={selectedAssignmentForEdit}
                    />
                )}
            </div>
            {/* ... (Global Styles from previous response) ... */}
            <style jsx global>{`
                .input-field { /* Basic input field styling */
                    display: block;
                    width: 100%;
                    padding-left: 0.75rem; 
                    padding-right: 0.75rem;
                    padding-top: 0.5rem; 
                    padding-bottom: 0.5rem;
                    border-width: 1px;
                    border-style: solid;
                    border-color: #D1D5DB; /* gray-300 */
                    border-radius: 0.375rem; /* rounded-md */
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
                    background-color: white;
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    appearance: none;
                    /* Ensures consistent styling across browsers */
                    height: 2.5rem; /* 40px */
                    box-sizing: border-box;
                }
                select.input-field {
                    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
                    background-position: right 0.5rem center;
                    background-repeat: no-repeat;
                    background-size: 1.5em 1.5em;
                    padding-right: 2.5rem;
                }
                input[type="text"].input-field,
                input[type="date"].input-field {
                    background-image: none;
                    padding-right: 0.75rem;
                }
                .input-field:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                    border-color: #3b82f6; /* blue-500 for CRM theme */
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5); /* ring-blue-500 */
                }
                .input-field:disabled { 
                    background-color: #f3f4f6; /* gray-100 */
                    cursor: not-allowed;
                }
                .btn-primary { 
                    background-color: #2563eb; /* blue-600 for CRM theme */
                    color: white;
                    padding: 0.625rem 1.25rem; 
                    font-weight: 500; 
                    font-size: 0.875rem; 
                    border-radius: 0.5rem; 
                    box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06); 
                }
                .btn-primary:hover {
                    background-color: #1d4ed8; /* blue-700 */
                }
                .btn-primary:disabled {
                    opacity: 0.5;
                }
            `}</style>
        </div>
    );
}