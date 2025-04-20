// 📁 File: AdminPanel.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';

// Define API Base URL
const API_BASE_URL = 'http://localhost:4000/api';

// --- Helper Functions ---
const formatCurrency = (amount) => (amount ? Number(amount).toFixed(2) : '0.00');
// Format date as YYYY-MM-DD
const formatDate = (dt) => dt ? new Date(dt).toLocaleDateString('en-CA') : 'N/A';
// Format date and time
const formatDateTime = (dt) => dt ? new Date(dt).toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A';
// Get today's date as YYYY-MM-DD string
const getTodayDateString = () => new Date().toLocaleDateString('en-CA');

// Helper function to format duration from milliseconds
const formatDuration = (ms) => {
    if (isNaN(ms) || ms < 0) return 'N/A'; if (ms === 0) return '0s';
    let seconds = Math.floor(ms / 1000), minutes = Math.floor(seconds / 60), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
    seconds %= 60; minutes %= 60; hours %= 24;
    const parts = [];
    if (days > 0) parts.push(`${days}d`); if (hours > 0) parts.push(`${hours}h`); if (minutes > 0) parts.push(`${minutes}m`); if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
};

const calculateTotal = (items) => {
    if (!Array.isArray(items) || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (Number(item?.totalAmount) || 0), 0);
};
const displayPaymentType = (paymentType) => {
    return paymentType === null || paymentType === undefined ? 'Unspecified' : paymentType;
};

// Define Product Options
const productOptions = ["Product A", "Product B", "Product C", "Product D", "Product E"];

// --- EditOrderModal Component ---
// (Keep EditOrderModal component as defined previously)
function EditOrderModal({ isOpen, onClose, orderData, onSave }) {
    const [formData, setFormData] = useState({ customerName: '', paymentType: '', items: [] });
    const [isSaving, setIsSaving] = useState(false);
    useEffect(() => { if (isOpen && orderData) { setFormData({ customerName: orderData.customerName || '', paymentType: orderData.paymentType === null ? 'null' : (orderData.paymentType || ''), items: Array.isArray(orderData.items) ? orderData.items.map(item => ({ ...item })) : [] }); } else if (!isOpen) { setFormData({ customerName: '', paymentType: '', items: [] }); } }, [orderData, isOpen]);
    const handleMainFieldChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleItemChange = (index, field, value) => { setFormData(prev => { const newItems = [...prev.items]; if (newItems[index]) { newItems[index] = { ...newItems[index], [field]: value }; if ((field === 'quantity' || field === 'pricePerUnit') && newItems[index]) { const qty = parseFloat(newItems[index].quantity) || 0; const price = parseFloat(newItems[index].pricePerUnit) || 0; newItems[index].totalAmount = qty * price; } } return { ...prev, items: newItems }; }); };
    const handleAddItem = () => { setFormData(prev => ({ ...prev, items: [...prev.items, { productType: '', quantity: 1, pricePerUnit: 0, totalAmount: 0 }] })); };
    const handleRemoveItem = (index) => { setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) })); };
    const handleSave = async (e) => { e.preventDefault(); setIsSaving(true); try { const itemsToSave = formData.items.map(item => ({ ...item, quantity: parseFloat(item.quantity) || 0, pricePerUnit: parseFloat(item.pricePerUnit) || 0, totalAmount: (parseFloat(item.quantity) || 0) * (parseFloat(item.pricePerUnit) || 0), productType: item.productType || 'N/A' })).filter(item => item.quantity > 0 && item.pricePerUnit >= 0 && item.productType && item.productType !== 'N/A'); if (itemsToSave.length !== formData.items.length) { alert("Select Product Type."); setIsSaving(false); return; } if (itemsToSave.length === 0) { alert("Add items."); setIsSaving(false); return; } const dataToSave = { customerName: formData.customerName, paymentType: formData.paymentType === 'null' ? null : formData.paymentType, orderItems: itemsToSave }; await onSave(orderData.id, dataToSave); onClose(); } catch (error) { console.error("Save error:", error); } finally { setIsSaving(false); } };
    if (!isOpen || !orderData) return null;
    return ( /* ... Modal JSX ... */
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-start p-4 pt-10"><div className="relative bg-white w-full max-w-2xl mx-auto p-6 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto"><h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Edit Order #{orderData.id}</h3><button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 focus:outline-none" aria-label="Close modal"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button><form onSubmit={handleSave}><div className="space-y-4"><div><label htmlFor="customerName" className="block text-sm font-medium text-gray-700">Customer Name</label><input type="text" name="customerName" id="customerName" value={formData.customerName || ''} onChange={handleMainFieldChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" /></div><div><label htmlFor="paymentType" className="block text-sm font-medium text-gray-700">Payment Type</label><select name="paymentType" id="paymentType" value={formData.paymentType || ''} onChange={handleMainFieldChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"><option value="">Unspecified</option><option value="null">None</option><option value="Cash">Cash</option><option value="Debit">Debit</option><option value="Credit">Credit</option></select></div><div className="mt-6 border-t pt-4"><h4 className="text-md font-medium text-gray-800 mb-2">Order Items</h4>{formData.items.length === 0 && ( <p className="text-sm text-gray-500 text-center py-2">No items.</p> )}<div className="space-y-3 max-h-60 overflow-y-auto pr-2">{formData.items.map((item, index) => ( <div key={index} className="grid grid-cols-12 gap-2 items-center border p-2 rounded bg-gray-50"><div className="col-span-4"><label htmlFor={`item-type-${index}`} className="sr-only">Type</label><select id={`item-type-${index}`} value={item.productType || ''} onChange={(e) => handleItemChange(index, 'productType', e.target.value)} className="block w-full px-2 py-1 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"><option value="" disabled>-- Select --</option>{productOptions.map(opt => ( <option key={opt} value={opt}>{opt}</option> ))}</select></div><div className="col-span-2"><label htmlFor={`item-qty-${index}`} className="sr-only">Qty</label><input type="number" id={`item-qty-${index}`} placeholder="Qty" min="0" step="any" value={item.quantity || ''} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" /></div><div className="col-span-3"><label htmlFor={`item-price-${index}`} className="sr-only">Price</label><input type="number" id={`item-price-${index}`} placeholder="Price/Unit" min="0" step="0.01" value={item.pricePerUnit || ''} onChange={(e) => handleItemChange(index, 'pricePerUnit', e.target.value)} className="block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" /></div><div className="col-span-2 text-right text-xs text-gray-600 pr-1"> {formatCurrency(item.totalAmount)} ฿ </div><div className="col-span-1 flex justify-end"><button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100" title="Remove Item"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></div> ))}</div><div className="mt-3 text-right"><button type="button" onClick={handleAddItem} className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"><svg className="-ml-0.5 mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg> Add Item</button></div></div></div><div className="mt-6 flex justify-end space-x-3 border-t pt-4"><button type="button" onClick={onClose} disabled={isSaving} className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">Cancel</button><button type="submit" disabled={isSaving} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"> {isSaving ? 'Saving...' : 'Save Changes'} </button></div></form></div></div>
    );
}


// --- OrderRow Component ---
// Renders a single order row and its collapsible details
function OrderRow({ order, isExpanded, onToggleExpand, onEdit, onDelete, onPrint }) { // Added onPrint prop
    const total = useMemo(() => calculateTotal(order.items), [order.items]);
    const timeToCompletion = useMemo(() => { /* ... calculation ... */
        if (order.status === 'Completed' && order.createdAt && order.statusUpdatedAt) {
            try { const createdDate = new Date(order.createdAt); const completedDate = new Date(order.statusUpdatedAt); if (!isNaN(createdDate.getTime()) && !isNaN(completedDate.getTime())) { const diffMs = completedDate.getTime() - createdDate.getTime(); return formatDuration(diffMs); } } catch (e) { console.error("Error calculating duration:", e); return "Error"; } } return null;
    }, [order.status, order.createdAt, order.statusUpdatedAt]);
    const handleButtonClick = (e, action) => { e.stopPropagation(); action(); };

    return (
        <>
            {/* Main Order Row */}
            <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onToggleExpand(order.id)}>
                 <td className="px-3 py-2 whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-500 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></td>
                 <td className="px-3 py-2 whitespace-nowrap font-medium">{order.id}</td>
                 <td className="px-3 py-2">{order.customerName || '-'}</td>
                 <td className="px-3 py-2 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                 <td className="px-3 py-2">{displayPaymentType(order.paymentType)}</td>
                 <td className="px-3 py-2 text-right">{formatCurrency(total)} ฿</td>
                 {/* Actions Cell - MODIFIED */}
                 <td className="px-3 py-2 whitespace-nowrap text-right space-x-2">
                     {/* Print Button */}
                     <button className="text-gray-500 hover:text-gray-700 hover:underline focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 rounded px-1 py-0.5 inline-flex items-center" onClick={(e) => handleButtonClick(e, () => onPrint(order.id))} title={`Print Bill #${order.id}`}>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /> </svg>
                     </button>
                    {/* Edit Button */}
                    <button className="text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-50 rounded px-1 py-0.5 inline-flex items-center" onClick={(e) => handleButtonClick(e, () => onEdit(order.id))} title={`Edit Order #${order.id}`}>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /> </svg>
                    </button>
                    {/* Delete Button */}
                    <button className="text-red-600 hover:text-red-800 hover:underline focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-50 rounded px-1 py-0.5 inline-flex items-center" onClick={(e) => handleButtonClick(e, () => onDelete(order.id))} title={`Delete Order #${order.id}`}>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /> </svg>
                    </button>
                </td>
            </tr>
            {/* Collapsible Details Row */}
            {isExpanded && ( <tr key={`${order.id}-details`} className="bg-gray-50"><td></td><td colSpan="6" className="px-4 py-3 text-sm text-gray-700"><div className="border-l-4 border-blue-300 pl-3 space-y-1"><h4 className="font-semibold mb-1 text-gray-800">Order #{order.id} Details:</h4>{Array.isArray(order.items) && order.items.length > 0 ? (<div><p className="text-xs font-medium text-gray-600">Items:</p><ul className="list-disc list-inside ml-4 text-xs">{order.items.map(item => ( <li key={item.id || item.productId}> {item.productType || 'N/A'} (x{item.quantity || 1}) - {formatCurrency(item.totalAmount)} ฿ </li> ))}</ul></div>) : ( <p className="text-xs text-gray-500 italic">No item details.</p> )}<p className="text-xs"><strong className="font-medium text-gray-600">Customer:</strong> {order.customerName || 'N/A'}</p><p className="text-xs"><strong className="font-medium text-gray-600">Payment:</strong> {displayPaymentType(order.paymentType)}</p><p className="text-xs"><strong className="font-medium text-gray-600">Driver:</strong> {order.driverName || 'N/A'}</p><p className="text-xs"><strong className="font-medium text-gray-600">Status:</strong> {order.status || 'N/A'}</p><p className="text-xs"><strong className="font-medium text-gray-600">Created:</strong> {formatDateTime(order.createdAt)}</p><p className="text-xs"><strong className="font-medium text-gray-600">Last Update:</strong> {formatDateTime(order.statusUpdatedAt)}</p>{timeToCompletion && ( <p className="text-xs"><strong className="font-medium text-gray-600">Time to Completion:</strong> {timeToCompletion}</p> )}</div></td></tr> )}
        </>
    );
}


// --- Main AdminPanel Component ---
export default function AdminPanel() {
    // State variables
    const [orders, setOrders] = useState([]);
    // NEW: State for selected date in Manage Orders
    const [selectedDate, setSelectedDate] = useState(getTodayDateString()); // Default to today
    const [dailyDate, setDailyDate] = useState(getTodayDateString()); // For daily report
    const [dailyReport, setDailyReport] = useState(null);
    const [monthlyMonth, setMonthlyMonth] = useState(new Date().toISOString().slice(0, 7));
    const [monthlyReport, setMonthlyReport] = useState(null);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [loadingDaily, setLoadingDaily] = useState(false);
    const [loadingMonthly, setLoadingMonthly] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [orderSearchTerm, setOrderSearchTerm] = useState('');
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);

    // Clear success message effect
    useEffect(() => { if (successMessage) { const timer = setTimeout(() => setSuccessMessage(''), 3000); return () => clearTimeout(timer); } }, [successMessage]);

    // Fetch orders for the selected date - MODIFIED
    const fetchOrders = useCallback(async () => {
        setLoadingOrders(true);
        setError(''); // Clear previous order-specific errors
        console.log(`Fetching orders for date: ${selectedDate}...`);
        try {
            // Add date query parameter
            const res = await fetch(`${API_BASE_URL}/orders?date=${selectedDate}`);
            if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
            const data = await res.json();
            const ordersWithData = (Array.isArray(data) ? data : []).map(o => ({
                ...o, items: Array.isArray(o.items) ? o.items : [],
            }));
            setOrders(ordersWithData); // No need to sort here if backend already sorts by time DESC
            console.log(`Fetched ${ordersWithData.length} orders for ${selectedDate}.`);
        } catch (err) {
            console.error("Fetch orders error:", err);
            setError(`Failed to fetch orders for ${selectedDate}: ${err.message}`);
            setOrders([]); // Clear orders on error
        } finally {
            setLoadingOrders(false);
        }
        // Depend on selectedDate to refetch when it changes
    }, [selectedDate]);

    // useEffect to fetch orders when selectedDate changes
    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]); // fetchOrders depends on selectedDate

    // Delete an order
    const deleteOrder = async (id) => { if (!window.confirm(`Delete order #${id}?`)) return; setError(''); setSuccessMessage(''); try { const res = await fetch(`${API_BASE_URL}/orders/${id}`, { method: 'DELETE' }); if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `Delete failed (${res.status})`); } setSuccessMessage(`Order #${id} deleted.`); setExpandedOrderId(null); fetchOrders(); } catch (err) { setError(`Failed to delete order #${id}: ${err.message}`); } };

    // Open Edit Modal
    const handleOpenEditModal = (orderId) => { setError(''); setSuccessMessage(''); const orderToEdit = orders.find(o => o.id === orderId); if (orderToEdit) { setEditingOrder(orderToEdit); setIsEditModalOpen(true); } else { setError(`Could not find order ${orderId}.`); } };

    // Close Edit Modal
    const handleCloseEditModal = () => { setIsEditModalOpen(false); setEditingOrder(null); };

    // Save Edited Order
    const handleSaveOrder = async (orderId, updatedData) => { setError(''); setSuccessMessage(''); console.log(`Saving changes for order ${orderId}:`, updatedData); try { const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData), }); const result = await res.json(); if (!res.ok) { throw new Error(result.message || `Update failed (${res.status})`); } setSuccessMessage(result.message || `Order #${orderId} updated.`); fetchOrders(); } catch (err) { setError(`Failed to save order #${orderId}: ${err.message}`); throw err; } };

    // Toggle Order Details
    const handleToggleExpand = (orderId) => { setExpandedOrderId(prevId => (prevId === orderId ? null : orderId)); };

    // --- NEW: Print Order Handler ---
    const handlePrintOrder = (orderId) => {
        setError(''); setSuccessMessage(''); // Clear messages
        // Construct the print URL carefully (assuming API_BASE_URL is http://host:port/api)
        try {
            const url = new URL(API_BASE_URL); // Parse the base URL
            const printBaseUrl = `${url.protocol}//${url.host}`; // Get scheme and host (e.g., http://localhost:4000)
            const printUrl = `${printBaseUrl}/print-bill/${orderId}`;
            console.log(`Opening print URL: ${printUrl}`);
            window.open(printUrl, '_blank', 'noopener,noreferrer'); // Security best practice
        } catch (e) {
            console.error("Error constructing print URL from API_BASE_URL:", API_BASE_URL, e);
            setError("Could not create print URL.");
        }
    };

    // Fetch daily report
    const getDailyReport = async () => { if (!dailyDate) { setError("Select date."); return; } setLoadingDaily(true); setDailyReport(null); setError(''); setSuccessMessage(''); try { const res = await fetch(`${API_BASE_URL}/reports/daily?date=${dailyDate}`); if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(e.message || `Fetch failed (${res.status})`);} const data = await res.json(); setDailyReport(data); } catch (err) { setError(`Daily report error: ${err.message}`); } finally { setLoadingDaily(false); } };

    // Fetch monthly report
    const getMonthlyReport = async () => { if (!monthlyMonth) { setError("Select month."); return; } setLoadingMonthly(true); setMonthlyReport(null); setError(''); setSuccessMessage(''); try { const res = await fetch(`${API_BASE_URL}/reports/monthly?month=${monthlyMonth}`); if (!res.ok) {const e=await res.json().catch(()=>({})); throw new Error(e.message || `Fetch failed (${res.status})`);} const data = await res.json(); setMonthlyReport(data); } catch (err) { setError(`Monthly report error: ${err.message}`); } finally { setLoadingMonthly(false); } };

    // Filter orders (now filters orders fetched for the selected date)
    const filteredOrders = useMemo(() => {
        const term = orderSearchTerm.toLowerCase().trim();
        if (!term) return orders; // Return all orders fetched for the date if no search term
        return orders.filter(o =>
            o.customerName?.toLowerCase().includes(term) || String(o.id).includes(term)
        );
    }, [orders, orderSearchTerm]); // Depends on orders (which depends on selectedDate)

    // --- Render JSX ---
    return (
        <div className="p-4 md:p-6 lg:p-8 bg-gray-100 min-h-screen font-sans">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 pb-2 border-b border-gray-300">Admin Panel</h1>

            {/* Error/Success Messages */}
            {error && ( <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert"><strong className="font-bold">Error: </strong><span className="block sm:inline">{error}</span><span className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onClick={() => setError('')}><svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg></span></div> )}
            {successMessage && ( <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert"><strong className="font-bold">Success: </strong><span className="block sm:inline">{successMessage}</span><span className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onClick={() => setSuccessMessage('')}><svg className="fill-current h-6 w-6 text-green-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg></span></div> )}

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Section: Manage Orders - MODIFIED */}
                <section className="bg-white p-4 rounded-lg shadow border border-gray-200 lg:col-span-2">
                    {/* Header with Date Filter and Search */}
                    <div className="flex flex-wrap justify-between items-center gap-4 mb-4 pb-2 border-b">
                         <h2 className="text-xl font-semibold text-gray-700 flex-shrink-0">Manage Orders</h2>
                         <div className="flex items-center gap-4">
                             {/* Date Filter */}
                             <div>
                                 <label htmlFor="order-date-filter" className="text-sm font-medium text-gray-700 mr-2">Date:</label>
                                 <input
                                    type="date"
                                    id="order-date-filter"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)} // Update state, useEffect will trigger fetch
                                    className="border border-gray-300 p-1.5 rounded text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                 />
                             </div>
                             {/* Search Input */}
                             <input type="text" placeholder="Search within date..." value={orderSearchTerm} onChange={(e) => setOrderSearchTerm(e.target.value)} className="border border-gray-300 px-3 py-1.5 rounded text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto max-w-xs" />
                         </div>
                    </div>
                    {/* Order Table */}
                    {loadingOrders ? ( <p className="text-center text-gray-500 py-4">Loading orders for {selectedDate}...</p> ) : (
                        <div className="max-h-[60vh] overflow-y-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-gray-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="w-10 border-b-2 border-gray-300 px-3 py-2"></th>
                                        {['ID', 'Customer', 'Date', 'Payment', 'Total', 'Actions'].map(col => ( <th key={col} className={`border-b-2 border-gray-300 px-3 py-2 font-medium text-gray-600 uppercase tracking-wider ${col === 'Total' || col === 'Actions' ? 'text-right' : 'text-left'}`}>{col}</th> ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredOrders.length > 0 ? filteredOrders.map(o => (
                                        <OrderRow
                                            key={o.id} order={o} isExpanded={expandedOrderId === o.id}
                                            onToggleExpand={handleToggleExpand}
                                            onEdit={handleOpenEditModal}
                                            onDelete={deleteOrder}
                                            onPrint={handlePrintOrder} // Pass print handler
                                        />
                                    )) : (
                                        <tr><td colSpan="7" className="text-center p-4 text-gray-500">{orders.length === 0 ? `No orders found for ${selectedDate}.` : 'No orders match your search.'}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Daily Report Section */}
                <section className="bg-white p-4 rounded-lg shadow border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Daily Financial Report</h2>
                    <div className="flex flex-wrap items-center gap-2 mb-4"><label htmlFor="daily-date" className="text-sm font-medium text-gray-700">Date:</label><input type="date" id="daily-date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} className="border border-gray-300 p-1.5 rounded text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500" /><button onClick={getDailyReport} disabled={loadingDaily || !dailyDate} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"> {loadingDaily ? 'Fetching...' : 'Fetch Report'} </button></div>
                    {loadingDaily && <p className="text-sm text-gray-500">Loading...</p>}
                    {dailyReport && !loadingDaily && ( <div className="space-y-1 text-sm text-gray-700 mt-4 border-t pt-3"><p><strong>Date:</strong> {formatDate(dailyReport.date)}</p><p><strong>Total Orders:</strong> {dailyReport.totalOrders}</p><p><strong>Total Revenue:</strong> {formatCurrency(dailyReport.totalRevenue)} ฿</p><p><strong>Cash:</strong> {formatCurrency(dailyReport.cashSales)} ฿</p><p><strong>Debit:</strong> {formatCurrency(dailyReport.debitSales)} ฿</p><p><strong>Credit:</strong> {formatCurrency(dailyReport.creditSales)} ฿</p><p><strong>Unspecified:</strong> {formatCurrency(dailyReport.unspecifiedSales)} ฿</p></div> )}
                </section>

                {/* Monthly Report Section */}
                <section className="bg-white p-4 rounded-lg shadow border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Monthly Financial Report</h2>
                    <div className="flex flex-wrap items-center gap-2 mb-4"><label htmlFor="monthly-month" className="text-sm font-medium text-gray-700">Month:</label><input type="month" id="monthly-month" value={monthlyMonth} onChange={e => setMonthlyMonth(e.target.value)} className="border border-gray-300 p-1.5 rounded text-sm shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500" /><button onClick={getMonthlyReport} disabled={loadingMonthly || !monthlyMonth} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"> {loadingMonthly ? 'Fetching...' : 'Fetch Report'} </button></div>
                    {loadingMonthly && <p className="text-sm text-gray-500">Loading...</p>}
                    {monthlyReport && !loadingMonthly && ( <div className="mt-4 border-t pt-3"><h3 className="text-md font-semibold mb-2">Summary for {monthlyReport.month}</h3><div className="space-y-1 text-sm text-gray-700 mb-4"><p><strong>Total Orders:</strong> {monthlyReport.summary?.totalOrders ?? 0}</p><p><strong>Total Revenue:</strong> {formatCurrency(monthlyReport.summary?.totalRevenue)} ฿</p><p><strong>Cash:</strong> {formatCurrency(monthlyReport.summary?.cashSales)} ฿</p><p><strong>Debit:</strong> {formatCurrency(monthlyReport.summary?.debitSales)} ฿</p><p><strong>Credit:</strong> {formatCurrency(monthlyReport.summary?.creditSales)} ฿</p><p><strong>Unspecified:</strong> {formatCurrency(monthlyReport.summary?.unspecifiedSales)} ฿</p></div><h4 className="text-sm font-semibold mb-1">Daily Breakdown:</h4>{monthlyReport.dailyData?.length > 0 ? ( <div className="max-h-60 overflow-y-auto text-xs border rounded"><table className="w-full border-collapse"><thead className="bg-gray-100 sticky top-0"><tr>{['Date','Orders','Revenue','Cash','Debit','Credit', 'Unspec.'].map(col => ( <th key={col} className="border-b px-2 py-1 text-left font-medium text-gray-600">{col}</th> ))}</tr></thead><tbody className="divide-y divide-gray-200">{monthlyReport.dailyData.map(row => ( <tr key={row.date} className="hover:bg-gray-50"><td className="border-b px-2 py-1 whitespace-nowrap">{formatDate(row.date)}</td><td className="border-b px-2 py-1 text-right">{row.orderCount}</td><td className="border-b px-2 py-1 text-right">{formatCurrency(row.totalAmount)}</td><td className="border-b px-2 py-1 text-right">{formatCurrency(row.cashSales)}</td><td className="border-b px-2 py-1 text-right">{formatCurrency(row.debitSales)}</td><td className="border-b px-2 py-1 text-right">{formatCurrency(row.creditSales)}</td><td className="border-b px-2 py-1 text-right">{formatCurrency(row.unspecifiedSales)}</td></tr> ))}</tbody></table></div> ) : ( <p className="text-xs text-gray-500">No daily data.</p> )}</div> )}
                </section>
            </div>

            {/* Edit Modal */}
            <EditOrderModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} orderData={editingOrder} onSave={handleSaveOrder} />
        </div>
    );
}
