// 📁 File: MainLayout.js (Optimized Polling, ETag, Deselect Payment)
import React, { useState, useEffect, useCallback, memo, useRef, useMemo } from 'react';
import NewOrder from './NewOrder';
import BillsList from './BillsList'; // Will receive billsData prop now
import {
    DndContext, useDroppable, pointerWithin, PointerSensor, useSensor,
    useSensors, DragOverlay, closestCorners
} from '@dnd-kit/core';
import {
    SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Constants ---
// Use environment variable for API Base URL (important for deployment)
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const VALID_TARGET_COLUMNS = ['created', 'delivering', 'completed'];
const STATUS_MAP = { created: 'Created', delivering: 'Out for Delivery', completed: 'Completed' };
// --- OPTIMIZATION: Increased polling interval ---
const POLLING_INTERVALS = { monitor: 60000 }; // Poll every 60 seconds
// --- END OPTIMIZATION ---
const DRAG_ACTIVATION_DISTANCE = 10;
const SYNC_DEBOUNCE_TIME = 750; // Debounce time for syncing status updates
const PAYMENT_TYPES = ['Cash', 'Debit', 'Credit']; // Values sent to/from backend

// Mappings for display names
const paymentTypeDisplayNames = { Cash: 'เงินสด', Debit: 'เงินโอน', Credit: 'เครดิต' };
const statusDisplayNames = { created: 'ออกบิล', 'out for delivery': 'กำลังจัดส่ง', completed: 'เสร็จสิ้น', delivered: 'เสร็จสิ้น' };

// --- Helper Functions ---
const getDisplayStatus = (status) => { const lowerCaseStatus = String(status || '').toLowerCase().trim(); return statusDisplayNames[lowerCaseStatus] || status || 'ไม่ระบุ'; };
const formatDate = (dt) => dt ? new Date(dt).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A';
const calculateTotal = (items) => { if (!Array.isArray(items) || items.length === 0) return 0; return items.reduce((sum, item) => sum + (item.totalAmount || 0), 0); };
function getTimeAgo(timestamp) { if (!timestamp) return { text: '', minutes: 0 }; try { const now = new Date(); const past = new Date(timestamp); if (isNaN(past.getTime())) { console.warn("Invalid timestamp received:", timestamp); return { text: 'invalid date', minutes: 0 }; } const diffInSeconds = Math.max(0, Math.floor((now.getTime() - past.getTime()) / 1000)); const diffInMinutes = Math.floor(diffInSeconds / 60); const diffInHours = Math.floor(diffInMinutes / 60); const diffInDays = Math.floor(diffInHours / 24); let text = ''; if (diffInSeconds < 60) text = `${diffInSeconds}s ago`; else if (diffInMinutes < 60) text = `${diffInMinutes}m ago`; else if (diffInHours < 24) text = `${diffInHours}h ago`; else text = `${diffInDays}d ago`; return { text, minutes: diffInMinutes }; } catch (error) { console.error("Error parsing timestamp:", timestamp, error); return { text: 'error', minutes: 0 }; } }
function getTimeStyle(status, minutesAgo) { const styles = { default: { color: '#555', fontSize: '0.8em' }, warning: { color: 'orange', fontSize: '0.8em', fontWeight: 'bold' }, danger: { color: 'red', fontSize: '0.8em', fontWeight: 'bold' } }; const thresholds = { Created: { warning: 30, danger: 120 }, 'Out for Delivery': { warning: 60, danger: 180 }, }; const statusThresholds = thresholds[status]; if (statusThresholds) { if (minutesAgo >= statusThresholds.danger) return styles.danger; if (minutesAgo >= statusThresholds.warning) return styles.warning; } return styles.default; }


// --- Draggable Order Component (Memoized) ---
// Includes payment deselection logic and uses display names/helpers
const MemoizedDraggableOrder = memo(function DraggableOrder({ order, parentId, isOverlay = false, onDriverChange, onPaymentTypeChange }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(order.id), data: { type: 'order', order: order, parentId: parentId }, });
    const [isExpanded, setIsExpanded] = useState(false);
    const [editing, setEditing] = useState(false);
    const [tempDriver, setTempDriver] = useState(order.driverName || '');
    const inputRef = useRef(null);
    const isCompleted = order.status === 'Completed';
    const isOutForDelivery = order.status === 'Out for Delivery';
    useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);
    useEffect(() => { if (!isExpanded) { setEditing(false); } }, [isExpanded]);
    const style = { transform: !isOverlay ? CSS.Transform.toString(transform) : undefined, transition: !isOverlay ? transition : undefined, border: '1px solid #ccc', background: isCompleted ? '#e9ecef' : '#fff', opacity: isDragging && !isOverlay ? 0 : (isCompleted ? 0.8 : 1), visibility: isDragging && !isOverlay ? 'hidden' : 'visible', padding: '8px 10px', margin: !isOverlay ? '8px' : '0', borderRadius: '4px', boxShadow: isDragging ? '0 2px 5px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.1)', cursor: isDragging ? 'grabbing' : 'grab', boxSizing: 'border-box', position: 'relative', zIndex: isDragging ? 100 : 'auto', userSelect: 'none', ...(isOverlay && { boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'grabbing', opacity: 0.95, minWidth: '280px', background: isCompleted ? '#e9ecef' : '#fff', visibility: 'visible' }) };
    const submitChange = () => { setEditing(false); const trimmedDriver = tempDriver.trim(); if (trimmedDriver !== (order.driverName || '')) { onDriverChange(order.id, trimmedDriver); } };
    const relevantTimestamp = (order.status === 'Created' || !order.statusUpdatedAt) ? order.createdAt : order.statusUpdatedAt;
    const { text: timeAgoText, minutes: minutesInStatus } = getTimeAgo(relevantTimestamp);
    const timeStyle = getTimeStyle(order.status, minutesInStatus);
    const orderTotal = calculateTotal(order.items);
    const elementId = `order-${order.id}`;
    const toggleExpand = (e) => { if (isDragging) return; e.stopPropagation(); setIsExpanded(!isExpanded); };
    const handleEditClick = (e) => { if (isCompleted) return; e.stopPropagation(); setTempDriver(order.driverName || ''); setEditing(true); };
    const handleBlur = () => submitChange();
    const handleInputChange = (e) => setTempDriver(e.target.value);
    const handleKeyDown = (event) => { if (isCompleted) return; event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); submitChange(); } else if (event.key === 'Escape') { setTempDriver(order.driverName || ''); setEditing(false); } };
    const handlePaymentButtonClick = (e, clickedType) => { e.stopPropagation(); const currentPaymentType = order.paymentType ?? null; const valueToSend = (currentPaymentType === clickedType) ? null : clickedType; if (currentPaymentType !== valueToSend) { onPaymentTypeChange(order.id, valueToSend); } else { console.log("Payment type already set to:", valueToSend, "- no change needed in DraggableOrder."); } };
    const currentPaymentTypeForStyle = order.paymentType ?? null;
    return (
        <div ref={setNodeRef} id={elementId} style={style} {...(!isOverlay ? attributes : {})}>
            <div onClick={toggleExpand} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} {...(!isOverlay ? listeners : {})}>
                <div style={{ flexGrow: 1 }}>
                    {isCompleted ? ( <strong style={{ display: 'inline', fontSize: '0.95em' }}>#{order.id} • {order.customerName || 'ไม่มีชื่อลูกค้า'}</strong> ) : ( <> <strong style={{ display: 'inline', fontSize: '1em', marginRight: '5px' }}>{order.customerName || 'ไม่มีชื่อลูกค้า'}</strong> {isOutForDelivery && ( <span style={{ fontSize: '0.85em', color: '#555', fontStyle: 'italic' }}>(คนขับ: {order.driverName || 'N/A'})</span> )} <span style={{ display: 'block', fontSize: '0.8em', color: '#666' }}>#{order.id}</span> </> )}
                    {!isCompleted && timeAgoText && ( <span style={{ display: 'block', ...timeStyle }}>({timeAgoText})</span> )}
                </div>
                <span style={{ fontSize: '0.8em', color: '#888', marginLeft: '10px' }}>{isExpanded ? '▲' : '▼'}</span>
            </div>
            {isExpanded && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
                    <div style={{ fontSize:'0.9em', display: 'flex', alignItems: 'center', minHeight: '24px', marginBottom: '8px' }}> <strong style={{ marginRight: '5px', color: '#333', width: '60px', flexShrink: 0 }}>คนขับ:</strong> {editing && !isCompleted ? ( <input ref={inputRef} type="text" value={tempDriver} onChange={handleInputChange} onBlur={handleBlur} onKeyDown={handleKeyDown} style={{ flexGrow: 1, padding: '2px 4px', border: '1px solid #aaa', borderRadius: '3px', fontSize: '0.95em', marginRight: '5px', boxSizing: 'border-box' }} placeholder='ใส่ชื่อคนขับ' onClick={(e) => e.stopPropagation()} /> ) : ( <> <span style={{ color: order.driverName ? '#000' : '#777', flexGrow: 1 }}>{order.driverName || '-'}</span> {!isCompleted && ( <button onClick={handleEditClick} title="แก้ไขชื่อคนขับ" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: '1em', color: '#555', marginLeft: 'auto' }} onMouseDown={(e) => e.stopPropagation()} >✏️</button> )} </> )} </div>
                    <div style={{ fontSize:'0.9em', display: 'flex', alignItems: 'center', minHeight: '24px', marginBottom: '8px' }}> <strong style={{ marginRight: '5px', color: '#333', width: '60px', flexShrink: 0 }}>วิธีชำระ:</strong> <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}> {PAYMENT_TYPES.map(type => { const isActive = currentPaymentTypeForStyle === type; return ( <button key={type} onClick={(e) => handlePaymentButtonClick(e, type)} title={`ตั้งเป็น ${paymentTypeDisplayNames[type]} ${isActive ? '(คลิกอีกครั้งเพื่อยกเลิก)' : ''}`} style={{ padding: '2px 8px', fontSize: '0.85em', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', background: isActive ? '#3b82f6' : '#f3f4f6', color: isActive ? 'white' : '#1f2937', fontWeight: isActive ? '600' : 'normal', transition: 'background-color 0.15s ease-in-out, color 0.15s ease-in-out', }} > {paymentTypeDisplayNames[type]} </button> ); })} </div> </div>
                    <div style={{ fontSize: '0.85em', color: '#555', marginBottom: '4px' }}>สร้างเมื่อ: {formatDate(order.createdAt)}</div>
                    <div style={{ fontSize: '0.85em', color: '#555', marginBottom: '8px' }}>สถานะ: {getDisplayStatus(order.status)}</div>
                    {Array.isArray(order.items) && order.items.length > 0 && ( <div style={{ marginBottom: '8px' }}> <p style={{ fontSize: '0.85em', fontWeight: 'bold', marginBottom: '4px' }}>รายการ:</p> <ul style={{ paddingLeft: '18px', fontSize: '0.8em', listStyle: 'disc', margin: 0 }}> {order.items.map((item, index) => ( <li key={index}>{item.productType || 'N/A'} × {item.quantity || 0}</li> ))} </ul> </div> )}
                    {orderTotal > 0 && ( <div style={{ fontSize: '0.9em', fontWeight: 'bold', textAlign: 'right' }}> ยอดรวม: {orderTotal.toFixed(2)} ฿ </div> )}
                </div>
            )}
        </div>
    );
});

// --- Droppable Column Wrapper ---
function DroppableColumn({ id, children }) {
    const { setNodeRef } = useDroppable({ id, data: { type: 'column', accepts: ['order'], columnId: id } });
    const columnStyle = { flex: 1, minWidth: '300px', margin: '0 10px', background: '#f4f4f4', borderRadius: '4px', display: 'flex', flexDirection: 'column' };
    return ( <div ref={setNodeRef} style={columnStyle}> {children} </div> );
}


// --- Monitor Column Component ---
function MonitorColumn({ title, orders = [], columnId, searchTerm, onSearchChange, onDriverChange, onPaymentTypeChange }) {
    const filteredOrders = useMemo(() => { return orders.filter((order) => { const term = searchTerm.toLowerCase().trim(); if (!term) return true; const customerNameMatch = order.customerName?.toLowerCase().includes(term); const orderIdMatch = String(order.id).toLowerCase().includes(term); return customerNameMatch || orderIdMatch; }); }, [orders, searchTerm]);
    const orderIds = useMemo(() => filteredOrders.map(o => String(o.id)), [filteredOrders]);
    return (
        <DroppableColumn id={columnId}>
            <h3 style={{ textAlign: 'center', background: '#e0e0e0', padding: '8px 0', borderBottom: '1px solid #ccc', margin: '0', fontWeight: 'bold', flexShrink: 0 }}> {title} ({filteredOrders.length}) </h3>
            <div style={{ padding: '8px 8px 4px 8px', background: '#e0e0e0', flexShrink: 0 }}> <input type="text" value={searchTerm} onChange={(e) => onSearchChange(columnId, e.target.value)} placeholder={`ค้นหาใน ${title}...`} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '6px 8px', border: '1px solid #bbb', borderRadius: '3px', boxSizing: 'border-box', fontSize: '0.9em' }}/> </div>
            <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
                <div className="hide-scrollbar" style={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px 8px 8px', minHeight: '100px' }}>
                    {filteredOrders.length === 0 ? ( <p style={{ textAlign: 'center', color: '#888', padding: '20px' }}> {searchTerm ? 'ไม่พบรายการที่ค้นหา' : 'ไม่มีรายการ'} </p> )
                    : ( filteredOrders.map(order => ( <MemoizedDraggableOrder key={String(order.id)} order={order} parentId={columnId} onDriverChange={onDriverChange} onPaymentTypeChange={onPaymentTypeChange} /> )) )}
                </div>
            </SortableContext>
        </DroppableColumn>
    );
}

// --- Main Layout Component ---
export default function MainLayout() {
    // State
    const [ordersByStatus, setOrdersByStatus] = useState({ created: [], delivering: [], completed: [] });
    // --- OPTIMIZATION: State for raw bills list ---
    const [rawBills, setRawBills] = useState([]);
    // --- OPTIMIZATION: State for ETag ---
    const [lastEtag, setLastEtag] = useState(null);
    // --- END OPTIMIZATION ---
    const [pendingUpdates, setPendingUpdates] = useState([]);
    const [searchTerms, setSearchTerms] = useState({ created: '', delivering: '', completed: '' });
    const [activeId, setActiveId] = useState(null);
    const [activeOrderData, setActiveOrderData] = useState(null);
    const [isNewOrderVisible, setIsNewOrderVisible] = useState(true);

    // --- OPTIMIZATION: Consolidated & ETag-enabled Data Fetching ---
    const fetchOrderMonitor = useCallback(async () => {
        if (activeId || pendingUpdates.length > 0) { console.log("Skipping fetch: Active drag or pending updates."); return; }
        console.log("Fetching monitor/bills data...");
        try {
            const headers = {};
            if (lastEtag) { headers['If-None-Match'] = lastEtag; } // Send ETag if we have one

            const res = await fetch(`${API_BASE_URL}/orders/today`, { headers });

            // Handle 304 Not Modified
            if (res.status === 304) { console.log("Data not modified (304)."); return; }

            // Handle other errors
            if (!res.ok) { throw new Error(`HTTP error! status: ${res.status}`); }

            // Process 200 OK response
            const newEtag = res.headers.get('ETag'); // Get new ETag from response
            const allOrders = await res.json();

            if (!Array.isArray(allOrders)) { console.warn("Fetched data is not an array:", allOrders); setOrdersByStatus({ created: [], delivering: [], completed: [] }); setRawBills([]); return; }

            // Categorize for monitor
            const created = allOrders.filter(o => o.status === 'Created');
            const delivering = allOrders.filter(o => o.status === 'Out for Delivery');
            const completed = allOrders.filter(o => o.status === 'Completed');

            // Update state (only if not dragging/syncing - safety check)
            if (!activeId && pendingUpdates.length === 0) {
                setOrdersByStatus({ created, delivering, completed });
                setRawBills(allOrders); // Update raw bills list for BillsList component
                if (newEtag) { setLastEtag(newEtag); } // Store the new ETag
            }
        } catch (err) {
            console.error('Failed to fetch monitor/bills orders:', err);
            if (!activeId && pendingUpdates.length === 0) { setOrdersByStatus({ created: [], delivering: [], completed: [] }); setRawBills([]); /* Optionally clear ETag on error? setLastEtag(null); */ }
        }
    }, [activeId, pendingUpdates.length, lastEtag]); // Depend on lastEtag

    // Initial fetch & Polling setup
    useEffect(() => {
        fetchOrderMonitor(); // Initial fetch
        const interval = setInterval(fetchOrderMonitor, POLLING_INTERVALS.monitor); // Use updated interval
        return () => clearInterval(interval);
    }, [fetchOrderMonitor]); // fetchOrderMonitor is memoized

    // Pending updates sync effect (remains the same)
    useEffect(() => { if (pendingUpdates.length === 0) return; const [updateToSync, ...restOfQueue] = pendingUpdates; const { id, status } = updateToSync; const timer = setTimeout(() => { fetch(`${API_BASE_URL}/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }) .then(res => { if (!res.ok) { console.error(`Failed to sync order ${id} to ${status}. Status: ${res.status}`); } else { console.log(`Synced status successfully: Order ${id} -> ${status}`); } setPendingUpdates(restOfQueue); }) .catch(err => { console.error('Failed to sync order status:', err); setPendingUpdates(restOfQueue); }); }, SYNC_DEBOUNCE_TIME); return () => clearTimeout(timer); }, [pendingUpdates]);

    // Dnd Sensors (remains the same)
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }));

    // Callback Handlers
    // Update rawBills state in relevant handlers
    const handleDriverChange = useCallback(async (orderId, driverName) => {
        console.log(`Attempting to update driver for order ${orderId} to "${driverName}"`);
        const updateFunc = (o) => String(o.id) === String(orderId) ? { ...o, driverName } : o;
        setOrdersByStatus(prev => ({ created: (prev.created || []).map(updateFunc), delivering: (prev.delivering || []).map(updateFunc), completed: (prev.completed || []).map(updateFunc) }));
        setRawBills(prev => prev.map(updateFunc)); // Update rawBills too
        try {
            const r = await fetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ driverName }) });
            if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(`API Error: ${r.status} ${r.statusText} - ${d.message || 'Failed to update driver'}`); }
            console.log(`Successfully updated driver for order ${orderId}`);
            setLastEtag(null); // Invalidate ETag after successful update
        } catch (e) { console.error(`Failed to update driver for order ${orderId}:`, e); /* Consider reverting optimistic update */ }
    }, []);

    const handleMonitorSearchChange = useCallback((columnId, value) => { setSearchTerms(prev => ({ ...prev, [columnId]: value })); }, []);

    const handleOrderCreated = useCallback((newlyCreatedOrder) => {
        if (!newlyCreatedOrder?.id || !newlyCreatedOrder.status) { console.error("Optimistic update failed: Invalid new order data."); return; }
        const targetStatus = newlyCreatedOrder.status;
        const targetColumn = Object.keys(STATUS_MAP).find(key => STATUS_MAP[key] === targetStatus) || 'created';
        // Add to the specific status column
        setOrdersByStatus(prev => { const c = Array.isArray(prev[targetColumn]) ? prev[targetColumn] : []; if (c.some(o => o.id === newlyCreatedOrder.id)) return prev; return { ...prev, [targetColumn]: [newlyCreatedOrder, ...c] }; });
        // Add to the raw list for BillsList
        setRawBills(prev => { if (prev.some(o => o.id === newlyCreatedOrder.id)) return prev; return [newlyCreatedOrder, ...prev]; });
        console.log(`Optimistically updated monitor/bills for order ${newlyCreatedOrder.id}.`);
        setLastEtag(null); // Invalidate ETag after adding a new order
    }, []);

    const handlePaymentTypeChange = useCallback(async (orderId, newPaymentType) => {
        console.log(`Attempting to update payment type for order ${orderId} to "${newPaymentType}"`);
        const updateFunc = (o) => String(o.id) === String(orderId) ? { ...o, paymentType: newPaymentType } : o;
        setOrdersByStatus(prev => ({ created: (prev.created || []).map(updateFunc), delivering: (prev.delivering || []).map(updateFunc), completed: (prev.completed || []).map(updateFunc) }));
        setRawBills(prev => prev.map(updateFunc)); // Update rawBills too
        try {
            const r = await fetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentType: newPaymentType }) });
            if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(`API Error: ${r.status} ${r.statusText} - ${d.message || 'Failed to update payment'}`); }
            console.log(`Successfully updated payment type for order ${orderId}`);
            setLastEtag(null); // Invalidate ETag after successful update
        } catch (e) { console.error(`Failed to update payment type for order ${orderId}:`, e); /* Consider reverting optimistic update */ }
    }, []);

    // Drag and Drop Handlers
    const handleDragStart = useCallback((event) => { const { active } = event; setActiveId(active.id); setActiveOrderData(active.data.current?.order || null); }, []);
    const handleDragOver = useCallback((event) => { const { active, over } = event; if (!over || !activeId || !active.data.current?.parentId) return; const activeIdStr = String(active.id); const overIdStr = String(over.id); const activeContainer = active.data.current.parentId; let overContainer = null; if (over.data.current?.type === 'column') overContainer = over.id; else if (over.data.current?.type === 'order') overContainer = over.data.current.parentId; else if (VALID_TARGET_COLUMNS.includes(over.id)) overContainer = over.id; if (!overContainer || !VALID_TARGET_COLUMNS.includes(overContainer)) return; if (activeContainer === overContainer) { if (over.data.current?.type === 'order' && activeIdStr !== overIdStr) { setOrdersByStatus((prev) => { const items = prev[activeContainer] || []; const activeIndex = items.findIndex(item => String(item.id) === activeIdStr); const overIndex = items.findIndex(item => String(item.id) === overIdStr); if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) { return { ...prev, [activeContainer]: arrayMove(items, activeIndex, overIndex) }; } return prev; }); } } else { if (active.data.current.parentId !== overContainer) { active.data.current.parentId = overContainer; } } }, [activeId]);
    const handleDragEnd = useCallback((event) => {
        const { active, over } = event; const orderData = active.data.current?.order;
        if (!activeId || !orderData) { setActiveId(null); setActiveOrderData(null); return; }
        const orderId = String(active.id); const originalStatus = orderData.status; const originalColumnId = Object.keys(STATUS_MAP).find(key => STATUS_MAP[key] === originalStatus);
        let finalContainerId = null;
        if (over) { if (over.data.current?.type === 'column') finalContainerId = over.id; else if (over.data.current?.type === 'order') finalContainerId = over.data.current.parentId; else if (VALID_TARGET_COLUMNS.includes(over.id)) finalContainerId = over.id; }
        if (!finalContainerId || !VALID_TARGET_COLUMNS.includes(finalContainerId)) { finalContainerId = active.data.current?.parentId; if (!finalContainerId || !VALID_TARGET_COLUMNS.includes(finalContainerId)) { setActiveId(null); setActiveOrderData(null); return; } }
        const finalStatus = STATUS_MAP[finalContainerId];
        if (originalColumnId !== finalContainerId) {
            let itemToMoveGlobal = null;
            setOrdersByStatus(prev => {
                if (!originalColumnId || !prev[originalColumnId]) { return prev; }
                const sourceItems = [...prev[originalColumnId]]; const destinationItems = [...(prev[finalContainerId] || [])]; let itemIndex = sourceItems.findIndex(item => String(item.id) === orderId); let actualSourceColumn = originalColumnId;
                if (itemIndex === -1) { let actualIndex = -1; for (const colId of VALID_TARGET_COLUMNS) { actualIndex = (prev[colId] || []).findIndex(item => String(item.id) === orderId); if (actualIndex !== -1) { actualSourceColumn = colId; itemIndex = actualIndex; break; } } if (actualSourceColumn !== originalColumnId) { sourceItems.splice(0, sourceItems.length, ...prev[actualSourceColumn]); } else { return prev; } }
                const [itemToMove] = sourceItems.splice(itemIndex, 1);
                itemToMoveGlobal = { ...itemToMove, status: finalStatus };
                destinationItems.push(itemToMoveGlobal);
                return { ...prev, [actualSourceColumn]: sourceItems, [finalContainerId]: destinationItems, };
            });
            if (itemToMoveGlobal) { setRawBills(prev => prev.map(bill => String(bill.id) === orderId ? itemToMoveGlobal : bill)); } // Update rawBills
            setPendingUpdates((queue) => { if (!queue.some(p => String(p.id) === orderId && p.status === finalStatus)) { return [...queue, { id: orderId, status: finalStatus }]; } return queue; });
            setLastEtag(null); // Invalidate ETag after status change
        }
        setActiveId(null); setActiveOrderData(null);
    }, [activeId]); // Removed ordersByStatus dependency
    const handleDragCancel = useCallback(() => { setActiveId(null); setActiveOrderData(null); fetchOrderMonitor(); }, [fetchOrderMonitor]);


    // --- Render JSX ---
    return (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel} >
            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; overflow-y: auto; }`}</style>
            <div style={{ display: 'flex', height: '100vh', fontFamily: 'Prompt, sans-serif', background: '#f0f2f5' }}>
                {/* Left column */}
                <div style={{ width: '440px', display: 'flex', flexDirection: 'column', borderRight: '2px solid #ccc', background: '#fff', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}>
                    {isNewOrderVisible && ( <div style={{ padding: '3px', borderBottom: '1px solid #eee', flexShrink: 0 }}> <NewOrder onOrderCreated={handleOrderCreated} /> </div> )}
                    <div style={{ padding: '8px 15px 0px 15px', borderBottom: '1px solid #eee', flexShrink: 0 }}> <button onClick={() => setIsNewOrderVisible(prev => !prev)} style={{ width: '100%', padding: '4px 8px', marginBottom: '10px', fontSize: '0.85em', fontWeight: 'bold', color: '#444', background: '#e8e8e8', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }} aria-expanded={isNewOrderVisible} > {isNewOrderVisible ? '➖ ซ่อนฟอร์มออกบิล' : '➕ แสดงฟอร์มออกบิล'} </button> </div>
                    {/* --- OPTIMIZATION: Pass rawBills data down --- */}
                    <BillsList billsData={rawBills} />
                    {/* --- END OPTIMIZATION --- */}
                </div>

                {/* Right column: Order Monitor */}
                <div style={{ flex: 1, padding: '20px', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontWeight: 'bold', fontSize: '1.3rem', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #ddd', flexShrink: 0 }}>ติดตามคำสั่งซื้อ & มอบหมายงาน</h2>
                    <div style={{ display: 'flex', flexGrow: 1, gap: '10px', overflowY: 'hidden' }}>
                        <MonitorColumn title="🆕 รอมอบหมาย" orders={ordersByStatus.created} columnId="created" searchTerm={searchTerms.created} onSearchChange={handleMonitorSearchChange} onDriverChange={handleDriverChange} onPaymentTypeChange={handlePaymentTypeChange} />
                        <MonitorColumn title="🚚 กำลังจัดส่ง" orders={ordersByStatus.delivering} columnId="delivering" searchTerm={searchTerms.delivering} onSearchChange={handleMonitorSearchChange} onDriverChange={handleDriverChange} onPaymentTypeChange={handlePaymentTypeChange} />
                        <MonitorColumn title="✅ เสร็จสิ้น" orders={ordersByStatus.completed} columnId="completed" searchTerm={searchTerms.completed} onSearchChange={handleMonitorSearchChange} onDriverChange={handleDriverChange} onPaymentTypeChange={handlePaymentTypeChange} />
                    </div>
                </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={null}>
                {activeId && activeOrderData ? ( <MemoizedDraggableOrder order={activeOrderData} parentId={null} isOverlay={true} onDriverChange={() => {}} onPaymentTypeChange={() => {}} /> ) : null}
            </DragOverlay>
        </DndContext>
    );
}
