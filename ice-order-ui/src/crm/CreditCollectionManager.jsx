// ice-delivery-app/ice-order-ui/src/crm/CreditCollectionManager.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiService } from '../apiService';
import CreditList from './CreditList'; 
import PaymentForm from './PaymentForm'; 
import PastPaymentsList from './PastPaymentsList';
import EditPaymentForm from './EditPaymentForm'; 

const CustomerSearch = ({ onCustomerSelect, routes }) => {
    const [searchText, setSearchText] = useState('');
    const [selectedRoute, setSelectedRoute] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const debounceTimeoutRef = useRef(null);

    const fetchSuggestions = useCallback(() => {
        // --- START FIX #2 ---
        // If there's no text and no route selected, do nothing.
        if (!searchText.trim() && !selectedRoute) {
            setSuggestions([]);
            setIsLoading(false);
            return;
        }
        // --- END FIX #2 ---

        setIsLoading(true);
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

        debounceTimeoutRef.current = setTimeout(async () => {
            try {
                const filters = { search: searchText, route_id: selectedRoute, is_active: true, limit: 15 };
                const response = await apiService.getCustomers(filters);
                setSuggestions(response.data || []);
            } catch (error) {
                console.error("Failed to fetch customer suggestions:", error);
                setSuggestions([]); // Clear suggestions on error
            } finally {
                setIsLoading(false);
            }
        }, 300);
    }, [searchText, selectedRoute]);

    useEffect(() => {
        // Fetch suggestions if any filter changes
        fetchSuggestions();
        return () => clearTimeout(debounceTimeoutRef.current);
    }, [fetchSuggestions]);

    const handleSelect = (customer) => {
        setSearchText('');
        setSuggestions([]);
        setSelectedRoute('');
        onCustomerSelect(customer);
    };

    return (
        <div className="p-4 bg-gray-100 border rounded-lg">
            <p className="text-md font-semibold mb-2 text-gray-700">ค้นหาลูกค้า</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="ค้นหาชื่อลูกค้าหรือเบอร์โทร..."
                    className="w-full input-field"
                />
                <select value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)} className="w-full input-field">
                    <option value="">สายทั้งหมด</option>
                    {routes.map(r => <option key={r.route_id} value={r.route_id}>{r.route_name}</option>)}
                </select>
            </div>
            {isLoading && <div className="p-2 text-sm text-gray-500">กำลังค้นหา...</div>}
            {suggestions.length > 0 && (
                <ul className="mt-2 border max-h-60 overflow-y-auto bg-white rounded-md">
                    {suggestions.map(cust => (
                        <li key={cust.customer_id} onMouseDown={() => handleSelect(cust)} className="p-2 border-b hover:bg-blue-50 cursor-pointer">
                            {cust.customer_name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default function CreditCollectionManager() {
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [outstandingSales, setOutstandingSales] = useState([]);
    const [selectedSaleIds, setSelectedSaleIds] = useState(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    
    // State for new components
    const [routes, setRoutes] = useState([]);
    const [pastPayments, setPastPayments] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // --- ADD NEW STATE FOR EDITING ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);
    const [currentUserRole, setCurrentUserRole] = useState(null);

    // Fetch user role on mount
    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('authUser'));
        setCurrentUserRole(user?.role?.toLowerCase());
    }, []);

    // Fetch routes once on component mount
    useEffect(() => {
        const fetchPrereqs = async () => {
            try {
                const { data: routesData } = await apiService.getDeliveryRoutes();
                setRoutes(routesData || []);
            } catch (err) {
                setError("Could not load initial routes data.");
            }
        };
        fetchPrereqs();
    }, []);

    // --- START FIX #1: Create a dedicated data fetching function ---
    const fetchDataForSelectedCustomer = useCallback(async () => {
        if (!selectedCustomer) return;

        setIsLoading(true);
        setError(null);
        try {
            const [sales, payments] = await Promise.all([
                apiService.getCustomerCreditSales(selectedCustomer.customer_id),
                apiService.getCustomerCreditPayments(selectedCustomer.customer_id)
            ]);
            setOutstandingSales(sales || []);
            setPastPayments(payments || []);
        } catch (err) {
            setError(err.data?.error || 'Failed to fetch customer data.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedCustomer]); // This function updates whenever selectedCustomer changes

    // This effect now just calls our dedicated fetch function
    useEffect(() => {
        fetchDataForSelectedCustomer();
        setSelectedSaleIds(new Set()); // Also reset selections when data reloads
    }, [fetchDataForSelectedCustomer]);
    // --- END FIX #1 ---
    
    const handleCustomerSelect = (customer) => {
        setSelectedCustomer(customer);
    };

    const handleClearCustomer = () => {
        setSelectedCustomer(null);
    };

    const totalSelectedAmount = useMemo(() => {
        return outstandingSales.reduce((total, sale) => {
            return selectedSaleIds.has(sale.sale_id) ? total + parseFloat(sale.total_sale_amount) : total;
        }, 0);
    }, [selectedSaleIds, outstandingSales]);

    const handlePaymentSubmit = async (paymentData, paymentSlipFile) => {
        setError(null);
        setSuccessMessage('');
        const formData = new FormData();
        Object.keys(paymentData).forEach(key => formData.append(key, paymentData[key]));
        formData.append('cleared_sale_ids', JSON.stringify(Array.from(selectedSaleIds)));
        if (paymentSlipFile) {
            formData.append('payment_slip_image', paymentSlipFile);
        }

        try {
            await apiService.addCustomerCreditPayment(selectedCustomer.customer_id, formData);
            setSuccessMessage('Payment successfully recorded!');
            // Refresh data for the current customer
            fetchDataForSelectedCustomer(); // <-- FIX #1: Call the new fetch function
            return true;
        } catch (err) {
            setError(err.data?.error || 'Failed to submit payment.');
            return false;
        }
    };

    // --- ADD HANDLERS FOR EDIT/VOID MODALS AND ACTIONS ---
    const handleOpenEditModal = (payment) => {
        setEditingPayment(payment);
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setEditingPayment(null);
        setIsEditModalOpen(false);
    };

    const handleUpdatePayment = async (paymentId, paymentData) => {
        // This function will be passed to EditPaymentForm
        try {
            await apiService.updateCreditPayment(paymentId, paymentData);
            setSuccessMessage("Payment details updated successfully!");
            // Refresh data for the current customer
            fetchDataForSelectedCustomer(); // <-- FIX #1: Call the new fetch function 
        } catch (err) {
            setError(err.data?.error || "Failed to update payment.");
            throw err; // Re-throw to show error in the modal
        }
    };

    const handleVoidPayment = async (paymentId) => {
        const reason = prompt("Please provide a reason for voiding this payment:");
        if (reason === null) return; // User cancelled
        
        setError(null);
        setSuccessMessage('');

        try {
            await apiService.voidCreditPayment(paymentId, reason);
            setSuccessMessage("Payment successfully voided. Outstanding sales have been updated.");
             // Refresh data for the current customer
            fetchDataForSelectedCustomer(); // <-- FIX #1: Call the new fetch function;
        } catch (err) {
            setError(err.data?.error || "Failed to void payment.");
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen rounded-lg shadow">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">การจัดเก็บเครดิต</h1>

            {successMessage && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">{successMessage}</div>}
            {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}

            <div className="bg-white p-6 rounded-lg shadow">
                {!selectedCustomer ? (
                    <CustomerSearch onCustomerSelect={handleCustomerSelect} routes={routes} />
                ) : (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">เครดิตค้างชำระของ: <span className="text-blue-600">{selectedCustomer.customer_name}</span></h2>
                            <button onClick={handleClearCustomer} className="text-sm text-blue-500 hover:underline">เปลี่ยนลูกค้า</button>
                        </div>

                        {isLoading ? (
                            <p>กำลังโหลดข้อมูลลูกค้า...</p>
                        ) : (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2">
                                        <h3 className="font-semibold text-lg text-gray-700 mb-2">ยอดขายเครดิตค้างชำระ</h3>
                                        <CreditList
                                            sales={outstandingSales}
                                            selectedSaleIds={selectedSaleIds}
                                            setSelectedSaleIds={setSelectedSaleIds}
                                        />
                                    </div>
                                    <div>
                                        <PaymentForm
                                            totalSelectedAmount={totalSelectedAmount}
                                            onSubmit={handlePaymentSubmit}
                                            hasSelection={selectedSaleIds.size > 0}
                                        />
                                    </div>
                                </div>
                                <div className="border-t pt-6">
                                    <PastPaymentsList 
                                        payments={pastPayments}
                                        isLoading={isLoadingHistory}
                                        onEdit={handleOpenEditModal}
                                        onVoid={handleVoidPayment}
                                        userRole={currentUserRole}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {/* --- ADD THE EDIT MODAL RENDER --- */}
            {editingPayment && (
                <EditPaymentForm
                    isOpen={isEditModalOpen}
                    onClose={handleCloseEditModal}
                    onSave={handleUpdatePayment}
                    payment={editingPayment}
                />
            )}
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