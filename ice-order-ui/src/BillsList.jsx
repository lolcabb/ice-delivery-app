// 📁 File: BillsList.js (Optimized - Uses billsData Prop, Payment Deselect)
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiService } from './apiService'; // Import the apiService

// Constants
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'; // Use env var
const PAYMENT_TYPES = ['Cash', 'Debit', 'Credit'];

// Mapping for display names
const paymentTypeDisplayNames = { Cash: 'เงินสด', Debit: 'เงินโอน', Credit: 'เครดิต' };
const statusDisplayNames = { created: 'ออกบิล', 'out for delivery': 'กำลังจัดส่ง', completed: 'เสร็จสิ้น', delivered: 'เสร็จสิ้น' };

// Helper Functions
const formatDate = (dt) => dt ? new Date(dt).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A';
const calculateTotal = (items) => { if (!Array.isArray(items) || items.length === 0) return 0; return items.reduce((sum, item) => { const itemValue = Number(item.totalAmount) || 0; return sum + itemValue; }, 0); };
const getDisplayStatus = (status) => { const lowerCaseStatus = String(status || '').toLowerCase().trim(); return statusDisplayNames[lowerCaseStatus] || status || 'ไม่ระบุ'; };

// --- OPTIMIZATION: Accept billsData prop ---
export default function BillsList({ billsData = [] }) { // Default to empty array
    // --- REMOVED: Internal bills state and polling logic ---
    const [selectedOrder, setSelectedOrder] = useState(null); // Still needed for expanded view detail
    const [search, setSearch] = useState('');
    const [error, setError] = useState(''); // Still needed for update errors within the list

    // State for inline editing (remains the same)
    const [isEditingDriver, setIsEditingDriver] = useState(false);
    const [tempDriverName, setTempDriverName] = useState('');
    const driverInputRef = useRef(null);

    // --- REMOVED: fetchBillsData and polling useEffect ---

    // Effect to focus input when driver editing starts (remains the same)
    useEffect(() => {
        if (isEditingDriver && driverInputRef.current) {
            driverInputRef.current.focus();
            driverInputRef.current.select();
        }
    }, [isEditingDriver]);

    // --- OPTIMIZATION: Filter bills based on the billsData prop ---
    const filteredBills = useMemo(() => {
        // Sort billsData by createdAt descending before filtering
        const sortedBills = [...billsData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return sortedBills.filter((bill) => {
            const term = search.toLowerCase().trim();
            if (!term) return true;
            const customerNameMatch = bill.customerName?.toLowerCase().includes(term);
            const orderIdMatch = String(bill.id).toLowerCase().includes(term);
            return customerNameMatch || orderIdMatch;
        });
    }, [billsData, search]); // Depend on billsData prop

    // Handler to fetch full details when a bill is clicked
    const handleBillClick = useCallback(async (bill) => {
        setError('');
        setIsEditingDriver(false);
        if (selectedOrder?.id === bill.id) {
            setSelectedOrder(null); // Collapse if clicking the same bill
        } else {
            console.log(`Fetching details for bill #${bill.id}`);
            try {
                // These direct fetch calls don't include Authorization headers
                const fullOrder = await apiService.get(`/orders/${bill.id}`);
                setSelectedOrder(fullOrder); // Update selectedOrder with full details
            } catch (err) {
                console.error('Failed to load full order details:', err);
                setError('ไม่สามารถโหลดรายละเอียดบิลได้');
                setSelectedOrder(null);
            }
        }
    }, [selectedOrder]); // Depends on selectedOrder

    // Handler for Print button
    const handlePrintClick = useCallback((e, billId) => {
        e.stopPropagation();
        const printBaseUrl = API_BASE_URL.includes('/api') ? API_BASE_URL.split('/api')[0] : API_BASE_URL;
        window.open(`${printBaseUrl}/print-bill/${billId}`, '_blank');
    }, []); // No dependencies needed if API_BASE_URL is stable

    // Update Field API Call (used for driver/payment updates within this component)
    const updateOrderField = useCallback(async (orderId, fieldUpdate) => {
        setError(''); // Clear previous errors
        try {
            // Assuming apiService.put returns the updated order or a success indicator
            await apiService.put(`/orders/${orderId}`, fieldUpdate);
            console.log(`Successfully updated field for order ${orderId} via BillsList:`, fieldUpdate);
            // Re-fetch selected order details after successful update to show changes
            if (selectedOrder && selectedOrder.id === orderId) {
                 try {
                    const freshData = await apiService.get(`/orders/${orderId}`);
                    setSelectedOrder(freshData); // Update the expanded view
                 } catch (fetchErr) { console.error("Failed to refetch order after update success:", fetchErr); }
            }
            return true;
        } catch (err) {
            console.error(`Failed to update field for order ${orderId} via BillsList:`, err);
            const errorData = err.data || {}; // Safely access error data
            setError(`การอัปเดตล้มเหลว: ${errorData.message || err.message || 'Unknown error'}`);
            // Attempt to revert optimistic update by re-fetching details on error
            if (selectedOrder && selectedOrder.id === orderId) {
                 try {
                    const oldData = await apiService.get(`/orders/${orderId}`);
                    setSelectedOrder(oldData);
                 } catch (fetchErr) { console.error("Failed to refetch order after update error:", fetchErr); }
            }
            return false;
        }
    }, [selectedOrder]); // setError, setSelectedOrder are stable, apiService is a stable import

    const handleBillDriverChange = useCallback((orderId, newDriverName) => {
        if (!selectedOrder || selectedOrder.id !== orderId) return;
        const trimmedDriver = newDriverName.trim();
        if ((selectedOrder.driverName || '') !== trimmedDriver) {
            updateOrderField(orderId, { driverName: trimmedDriver });
        }
         setIsEditingDriver(false);
    }, [selectedOrder, updateOrderField]); // setIsEditingDriver is stable

     const startEditDriver = useCallback((e) => {
        e.stopPropagation();
        if (selectedOrder) {
            setTempDriverName(selectedOrder.driverName || '');
            setIsEditingDriver(true);
        }
    }, [selectedOrder]); // setTempDriverName, setIsEditingDriver are stable

    const handleDriverInputChange = useCallback((e) => {
        setTempDriverName(e.target.value);
    }, []); // setTempDriverName is stable

    const handleDriverInputBlur = useCallback(() => {
        if (isEditingDriver && selectedOrder) {
            handleBillDriverChange(selectedOrder.id, tempDriverName);
        }
    }, [isEditingDriver, selectedOrder, tempDriverName, handleBillDriverChange]);

    const handleDriverInputKeyDown = useCallback((e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedOrder) {
                handleBillDriverChange(selectedOrder.id, tempDriverName);
            }
        } else if (e.key === 'Escape') {
            setIsEditingDriver(false);
            setTempDriverName('');
        }
    }, [selectedOrder, tempDriverName, handleBillDriverChange]); // setIsEditingDriver, setTempDriverName are stable

    const handleBillPaymentTypeChange = useCallback((orderId, clickedType) => {
        if (!selectedOrder || selectedOrder.id !== orderId) return;
        const currentPaymentType = selectedOrder.paymentType ?? null;
        const valueToSend = (currentPaymentType === clickedType) ? null : clickedType;
        if (currentPaymentType !== valueToSend) { // Check if value actually changes
            updateOrderField(orderId, { paymentType: valueToSend });
        } else {
             console.log("Payment type already set to:", valueToSend, "- no change needed in BillsList.");
        }
    }, [selectedOrder, updateOrderField]);

    // --- JSX Structure (Uses filteredBills derived from props) ---
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
            {/* Header and Search */}
            <div style={{ padding: '8px 15px 0px 15px', borderBottom: '1px solid #eee', flexShrink: 0 }}>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '10px', fontWeight: 'bold' }}>📄 บิลวันนี้</h2>
                <input
                    type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="ค้นหาด้วย ชื่อ หรือ หมายเลขบิล"
                    style={{ width: '100%', padding: '8px 10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                />
            </div>

            {/* Bills List (Scrollable) */}
            <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '10px 15px 15px 15px' }}>
                 {error && <p className="text-red-600 text-xs text-center pb-2">{error}</p>}

                {/* Use filteredBills derived from props */}
                {filteredBills.length === 0 ? (
                    <p style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}> {search ? 'ไม่พบคำค้นหา' : 'ไม่พบบิล.'} </p>
                ) : (
                    <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                        {filteredBills.map((bill) => (
                            // List item rendering remains the same, uses 'bill' from filteredBills
                            <li key={bill.id} style={{ marginBottom: '10px', border: '1px solid #eee', borderRadius: '4px', background: selectedOrder?.id === bill.id ? '#eef' : '#fff' }}>
                                {/* Clickable header */}
                                <div style={{ padding: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => handleBillClick(bill)} >
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{bill.customerName || 'ไม่มีชื่อลูกค้า'}</div>
                                        <div style={{ fontSize: '0.85em', color: '#555' }}>#{bill.id} • {formatDate(bill.createdAt)}</div>
                                    </div>
                                    <span style={{ fontSize: '0.8em', color: '#888', marginLeft: '10px' }}> {selectedOrder?.id === bill.id ? '▲' : '▼'} </span>
                                </div>

                                {/* Expanded Details (uses selectedOrder state, which is fetched on click) */}
                                {selectedOrder?.id === bill.id && (
                                     <div style={{ background: '#f9f9f9', padding: '10px', borderTop: '1px solid #eee' }}>
                                        {/* Driver Info & Edit */}
                                        <div style={{ display: 'flex', alignItems: 'center', minHeight: '24px', marginBottom: '4px' }}>
                                            <strong style={{ marginRight: '5px', width: '60px', flexShrink: 0 }}>คนขับ:</strong>
                                            {isEditingDriver ? ( <input ref={driverInputRef} type="text" value={tempDriverName} onChange={handleDriverInputChange} onBlur={handleDriverInputBlur} onKeyDown={handleDriverInputKeyDown} style={{ flexGrow: 1, padding: '2px 4px', border: '1px solid #aaa', borderRadius: '3px', fontSize: '0.95em' }} onClick={(e) => e.stopPropagation()} /> )
                                            : ( <> <span style={{ color: selectedOrder.driverName ? '#000' : '#777', flexGrow: 1 }}> {selectedOrder.driverName || 'ยังไม่ได้มอบหมาย'} </span> <button onClick={startEditDriver} title="แก้ไขชื่อคนขับ" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: '1em', color: '#555', marginLeft: 'auto' }} > ✏️ </button> </> )}
                                        </div>
                                        {/* Status */}
                                        <p><strong>สถานะ:</strong> {getDisplayStatus(selectedOrder.status)}</p>
                                        {/* Payment Type Display and Buttons */}
                                        <div style={{ display: 'flex', alignItems: 'center', minHeight: '24px', marginTop: '4px', marginBottom: '4px' }}>
                                            <strong style={{ marginRight: '5px', width: '60px', flexShrink: 0 }}>วิธีชำระ:</strong>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginLeft: '10px' }}>
                                                {PAYMENT_TYPES.map(type => {
                                                    const currentPaymentType = selectedOrder.paymentType; // Use state for expanded detail
                                                    const isActive = currentPaymentType === type;
                                                    return ( <button key={type} onClick={(e) => { e.stopPropagation(); handleBillPaymentTypeChange(selectedOrder.id, type); }} title={`ตั้งเป็น ${paymentTypeDisplayNames[type]} ${isActive ? '(คลิกอีกครั้งเพื่อยกเลิก)' : ''}`} style={{ padding: '2px 8px', fontSize: '0.85em', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', background: isActive ? '#3b82f6' : '#f3f4f6', color: isActive ? 'white' : '#1f2937', fontWeight: isActive ? '600' : 'normal', transition: 'background-color 0.15s ease-in-out, color 0.15s ease-in-out', }} > {paymentTypeDisplayNames[type]} </button> );
                                                })}
                                            </div>
                                        </div>
                                        {/* Items List */}
                                        <p style={{ marginTop: '5px' }}><strong>รายการ:</strong></p>
                                        {(Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0) ? ( <ul style={{ paddingLeft: '18px', fontSize: '0.9em', listStyle: 'disc', margin:0 }}> {selectedOrder.items.map((item, index) => ( <li key={index}> {item.productType || 'N/A'} × {item.quantity || 0} @ {(Number(item.pricePerUnit) || 0).toFixed(2)} = {(Number(item.totalAmount) || 0).toFixed(2)} </li> ))} </ul> )
                                        : <p style={{ fontStyle: 'italic', fontSize: '0.9em' }}>ไม่พบรายการ.</p>}
                                        {/* Total */}
                                        <p style={{ marginTop: '8px', fontWeight: 'bold' }}> ยอดรวม: {calculateTotal(selectedOrder.items).toFixed(2)} ฿ </p>
                                        {/* Print Button */}
                                        <button onClick={(e) => handlePrintClick(e, bill.id)} style={{ marginTop: '10px', padding: '5px 12px', background: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}> พิมพ์บิล </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
