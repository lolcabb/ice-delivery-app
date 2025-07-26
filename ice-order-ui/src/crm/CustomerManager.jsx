// src/crm/CustomerManager.jsx
import React, { useState, useCallback } from 'react';
import CustomerList from './CustomerList';
import CustomerForm from './CustomerForm';
import useCustomerFilters from './hooks/useCustomerFilters';
import useCustomers from './hooks/useCustomers';
import useCustomerMutations from './hooks/useCustomerMutations';
import { useDeliveryRoutes } from './hooks/useDeliveryRoutes';

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

// --- Step 1: Define FilterControls as a separate, memoized component ---
// React.memo prevents re-rendering if the props haven't changed.
const FilterControls = React.memo(({ 
    filters, 
    localSearchTerm, 
    localCustomerType, 
    deliveryRoutes, 
    onFilterChange 
}) => {
    // This component will now only re-render when its specific props change.
    return (
        <div className="mb-6 p-4 bg-white shadow rounded-lg">
            <h3 className="text-md font-semibold text-gray-700 mb-3">กรองลูกค้า</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <input
                    type="text"
                    name="search"
                    value={localSearchTerm} // Bind to local state for immediate feedback
                    onChange={onFilterChange}
                    placeholder="ค้นหาชื่อ, เบอร์โทร, ผู้ติดต่อ"
                    className="input-field"
                />
                <select name="route_id" value={filters.route_id} onChange={onFilterChange} className="input-field">
                    <option value="">ทุกเส้นทาง</option>
                    {deliveryRoutes.map(route => <option key={route.route_id} value={route.route_id}>{route.route_name}</option>)}
                </select>
                <input
                    type="text"
                    name="customer_type"
                    value={localCustomerType} // Bind to local state
                    onChange={onFilterChange}
                    placeholder="ประเภทลูกค้า (เช่น ธุรกิจ)"
                    className="input-field"
                />
                <select name="is_active" value={filters.is_active} onChange={onFilterChange} className="input-field">
                    <option value="true">เปิดใช้งาน</option>
                    <option value="false">ปิดใช้งาน</option>
                    <option value="">ทุกสถานะ</option>
                </select>
            </div>
        </div>
    );
});


export default function CustomerManager() {
    const [successMessage, setSuccessMessage] = useState('');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);

    const {
        filters,
        localSearchTerm,
        localCustomerType,
        pagination,
        setPagination,
        handleFilterChange,
        handlePageChange
    } = useCustomerFilters();

    const { data, isLoading, error, refetch } = useCustomers({ page: pagination.page, limit: pagination.limit, filters });
    const customers = Array.isArray(data?.data?.data) ? data.data.data : [];

    React.useEffect(() => {
        if (data?.data?.pagination) {
            setPagination(prev => ({ ...prev, ...data.data.pagination }));
        }
    }, [data, setPagination]);

    const { data: deliveryRoutes = [] } = useDeliveryRoutes();

    const customerMutations = useCustomerMutations();


    const handleOpenFormModal = useCallback((customer = null) => {
        setEditingCustomer(customer);
        setIsFormModalOpen(true);
        setSuccessMessage('');
    }, []);

    const handleCloseFormModal = useCallback(() => {
        setIsFormModalOpen(false);
        setEditingCustomer(null);
    }, []);

    const handleSaveCustomer = useCallback(async (formDataFromForm) => {
        let opError = null;
        try {
            if (editingCustomer && editingCustomer.customer_id) {
                await customerMutations.updateCustomer({ id: editingCustomer.customer_id, data: formDataFromForm });
                setSuccessMessage(`อัปเดตลูกค้า "${formDataFromForm.customer_name}" สำเร็จ`);
            } else {
                await customerMutations.addCustomer(formDataFromForm);
                setSuccessMessage(`เพิ่มลูกค้า "${formDataFromForm.customer_name}" สำเร็จ`);
            }
            handleCloseFormModal();
        } catch (err) {
            console.error("Error saving customer in Manager:", err);
            opError = err.message;
            throw err;
        } finally {
            if (!opError) setTimeout(() => setSuccessMessage(''), 4000);
        }
    }, [editingCustomer, customerMutations, handleCloseFormModal]);

    const handleDeleteCustomer = useCallback(async (customerId) => {
        const customerToToggle = customers.find(c => c.customer_id === customerId);
        if (!customerToToggle) return;

        const actionText = customerToToggle.is_active ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน';
        if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการ ${actionText} ลูกค้า "${customerToToggle.customer_name}"?`)) {
            try {
                if (customerToToggle.is_active) {
                    await customerMutations.deleteCustomer(customerId);
                } else {
                    await customerMutations.updateCustomer({ id: customerId, data: { ...customerToToggle, is_active: true } });
                }
                setSuccessMessage(`ลูกค้า "${customerToToggle.customer_name}" ${actionText} เรียบร้อยแล้ว`);
            } catch (err) {
                console.error(`Failed to ${actionText} customer:`, err);
            } finally {
                setTimeout(() => setSuccessMessage(''), 4000);
            }
        }
    }, [customers, customerMutations]);
    
    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-[calc(100vh-theme(space.32))] rounded-lg shadow">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-3 border-b border-gray-300">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-0">
                        จัดการลูกค้า
                    </h1>
                    <button
                        onClick={() => handleOpenFormModal(null)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-sky-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors duration-150 flex items-center justify-center"
                    >
                        <PlusIcon />
                        เพิ่มลูกค้าใหม่
                    </button>
                </div>

                {successMessage && (
                    <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded-md text-sm shadow">
                        {successMessage}
                    </div>
                )}
                {error && !isFormModalOpen && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm shadow">
                        <strong>ข้อผิดพลาด:</strong> {error}
                        <button onClick={() => refetch()} className="ml-4 px-3 py-1 text-xs bg-red-200 hover:bg-red-300 rounded-md font-semibold">ลองอีกครั้ง</button>
                    </div>
                )}

                {/* --- Step 4: Render the memoized component with props --- */}
                <FilterControls
                    filters={filters}
                    localSearchTerm={localSearchTerm}
                    localCustomerType={localCustomerType}
                    deliveryRoutes={deliveryRoutes}
                    onFilterChange={handleFilterChange}
                />
                <CustomerList
                    customers={customers}
                    onEdit={handleOpenFormModal}
                    onDelete={handleDeleteCustomer}
                    isLoading={isLoading}
                    pagination={pagination}
                    onPageChange={handlePageChange}
                />

                <CustomerForm
                    isOpen={isFormModalOpen}
                    onClose={handleCloseFormModal}
                    onSave={handleSaveCustomer}
                    customer={editingCustomer}
                    deliveryRoutes={deliveryRoutes}
                />
            </div>
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
                }
                select.input-field {
                    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
                    background-position: right 0.5rem center;
                    background-repeat: no-repeat;
                    background-size: 1.5em 1.5em;
                    padding-right: 2.5rem;
                }
                input[type="text"].input-field,
                input[type="number"].input-field,
                input[type="tel"].input-field,
                input[type="date"].input-field,
                textarea.input-field {
                    background-image: none;
                    padding-right: 0.75rem;
                }
                .input-field:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                    border-color: #6366F1; /* indigo-500 */
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5);
                }
                .input-field:disabled,
                .input-field.disabled\\:bg-gray-100:disabled { 
                    background-color: #f3f4f6; /* gray-100 */
                    color: #6b7280; /* gray-500 */
                    border-color: #e5e7eb; /* gray-200 */
                    cursor: not-allowed;
                    opacity: 0.7;
                }
                .btn-primary { /* Example for a primary button style */
                    background-color: #4f46e5; /* indigo-600 */
                    color: white;
                    padding: 0.625rem 1.25rem; /* py-2.5 px-5 */
                    font-weight: 500; /* font-medium */
                    font-size: 0.875rem; /* text-sm */
                    border-radius: 0.5rem; /* rounded-lg */
                    box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06); /* shadow-md */
                }
                .btn-primary:hover {
                    background-color: #4338ca; /* indigo-700 */
                }
                .btn-primary:disabled {
                    opacity: 0.5;
                }
            `}</style>
        </div>
    );
}
