// 📁 File: MainLayout.jsx (using modular API and corrected dependencies)
import React, { useState, useEffect, useCallback, memo, useRef, useMemo, use } from 'react';
import NewOrder from './NewOrder';
import BillsList from './BillsList';
import {
    DndContext, useDroppable, pointerWithin, PointerSensor, useSensor,
    useSensors, DragOverlay, closestCorners
} from '@dnd-kit/core';
import {
    SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { request } from './api/base.js';

// --- Constants ---
const VALID_TARGET_COLUMNS = ['created', 'delivering', 'completed'];
const STATUS_MAP = { created: 'Created', delivering: 'Out for Delivery', completed: 'Completed' };
const POLLING_INTERVALS = { monitor: 60000 };
const DRAG_ACTIVATION_DISTANCE = 10;
const SYNC_DEBOUNCE_TIME = 750;
const PAYMENT_TYPES = ['Cash', 'Debit', 'Credit'];
const paymentTypeDisplayNames = { Cash: 'เงินสด', Debit: 'เงินโอน', Credit: 'เครดิต' };
const statusDisplayNames = { created: 'ออกบิล', 'out for delivery': 'กำลังจัดส่ง', completed: 'เสร็จสิ้น', delivered: 'เสร็จสิ้น' };

// --- Helper Functions --- (Assuming these are correct and remain unchanged)
const getDisplayStatus = (status) => { const lowerCaseStatus = String(status || '').toLowerCase().trim(); return statusDisplayNames[lowerCaseStatus] || status || 'ไม่ระบุ'; };
const formatDate = (dt) => dt ? new Date(dt).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A';
const calculateTotal = (items) => {if (!Array.isArray(items) || items.length === 0) return 0; return items.reduce((sum, item) => { const itemValue = Number(item.totalAmount) || 0; return sum + itemValue; }, 0); };
function getTimeAgo(timestamp) { if (!timestamp) return { text: '', minutes: 0 }; try { const now = new Date(); const past = new Date(timestamp); if (isNaN(past.getTime())) { console.warn("Invalid timestamp received:", timestamp); return { text: 'invalid date', minutes: 0 }; } const diffInSeconds = Math.max(0, Math.floor((now.getTime() - past.getTime()) / 1000)); const diffInMinutes = Math.floor(diffInSeconds / 60); const diffInHours = Math.floor(diffInMinutes / 60); const diffInDays = Math.floor(diffInHours / 24); let text = ''; if (diffInSeconds < 60) text = `${diffInSeconds}s ago`; else if (diffInMinutes < 60) text = `${diffInMinutes}m ago`; else if (diffInHours < 24) text = `${diffInHours}h ago`; else text = `${diffInDays}d ago`; return { text, minutes: diffInMinutes }; } catch (error) { console.error("Error parsing timestamp:", timestamp, error); return { text: 'error', minutes: 0 }; } }
function getTimeStyle(status, minutesAgo) { const styles = { default: { color: '#555', fontSize: '0.8em' }, warning: { color: 'orange', fontSize: '0.8em', fontWeight: 'bold' }, danger: { color: 'red', fontSize: '0.8em', fontWeight: 'bold' } }; const thresholds = { Created: { warning: 30, danger: 120 }, 'Out for Delivery': { warning: 60, danger: 180 }, }; const statusThresholds = thresholds[status]; if (statusThresholds) { if (minutesAgo >= statusThresholds.danger) return styles.danger; if (minutesAgo >= statusThresholds.warning) return styles.warning; } return styles.default; }


// --- Draggable Order Component (MemoizedDraggableOrder) ---
// (Assuming this component's internal logic is okay and doesn't need changes for this refactor)
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

    const submitChange = useCallback(() => {
        setEditing(false);
        const trimmedDriver = tempDriver.trim();
        if (trimmedDriver !== (order.driverName || '')) {
            onDriverChange(order.id, trimmedDriver);
        }
    }, [tempDriver, order.driverName, order.id, onDriverChange]);

    const relevantTimestamp = (order.status === 'Created' || !order.statusUpdatedAt) ? order.createdAt : order.statusUpdatedAt;
    const { text: timeAgoText, minutes: minutesInStatus } = getTimeAgo(relevantTimestamp);
    const timeStyle = getTimeStyle(order.status, minutesInStatus);
    const orderTotal = calculateTotal(order.items);
    const elementId = `order-${order.id}`;

    const toggleExpand = useCallback((e) => {
        if (isDragging) return;
        e.stopPropagation();
        setIsExpanded(prev => !prev);
    }, [isDragging]);

    const handleEditClick = useCallback((e) => {
        if (isCompleted) return;
        e.stopPropagation();
        setTempDriver(order.driverName || '');
        setEditing(true);
    }, [isCompleted, order.driverName]);

    const handleBlur = useCallback(() => submitChange(), [submitChange]);
    const handleInputChange = useCallback((e) => { setTempDriver(e.target.value); }, []);
        const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            submitChange();
            e.preventDefault(); // Prevent form submission if applicable
        } else if (e.key === 'Escape') {
            setEditing(false);
            setTempDriver(order.driverName || ''); // Reset on escape
        }
    }, [submitChange, order.driverName]);
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
// (Assuming this component's internal logic is okay)
function DroppableColumn({ id, children }) {
    const { setNodeRef } = useDroppable({ id, data: { type: 'column', accepts: ['order'], columnId: id } });
    const columnStyle = { flex: 1, minWidth: '300px', margin: '0 10px', background: '#f4f4f4', borderRadius: '4px', display: 'flex', flexDirection: 'column' };
    return ( <div ref={setNodeRef} style={columnStyle}> {children} </div> );
}

// --- Monitor Column Component ---
// (Assuming this component's internal logic is okay)
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
    const [ordersByStatus, setOrdersByStatus] = useState({ created: [], delivering: [], completed: [] });
    const [rawBills, setRawBills] = useState([]);
    // Store the last seen ETag in a ref so updates don't retrigger effects
    const lastEtagRef = useRef(null);
    const [pendingUpdates, setPendingUpdates] = useState([]);
    const pendingUpdatesRef = useRef(pendingUpdates);
    const [searchTerms, setSearchTerms] = useState({ created: '', delivering: '', completed: '' });
    const [activeId, setActiveId] = useState(null);
    const activeIdRef = useRef(activeId);
    const [activeOrderData, setActiveOrderData] = useState(null);
    const [isNewOrderVisible, setIsNewOrderVisible] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    // const fetchTimerRef = useRef(null); // From original user upload, seems unused, can be removed if so.

    // Keep refs in sync with state so stable callbacks can access latest values
    useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
    useEffect(() => { pendingUpdatesRef.current = pendingUpdates; }, [pendingUpdates]);

    // Stable polling function accessing state via refs to avoid effect re-runs
    const fetchOrderMonitor = useCallback(async () => {
        console.log(`[fetchOrderMonitor] Check conditions: activeId=${activeIdRef.current}, pendingUpdates.length=${pendingUpdatesRef.current.length}`);
        if (activeIdRef.current || pendingUpdatesRef.current.length > 0) {
            console.log("[fetchOrderMonitor] Skipping fetch: Active drag or pending updates.");
            return;
        }
        console.log("[fetchOrderMonitor] Fetching data. Current ETag:", lastEtagRef.current);
        setIsFetching(true);

        try {
            const response = await request('/orders/today', 'GET', null, lastEtagRef.current ? { headers: { 'If-None-Match': lastEtagRef.current } } : {});
            console.log('[fetchOrderMonitor] API response received:', JSON.stringify(response, null, 2));

            if (response.notModified) {
                console.log("[fetchOrderMonitor] Data not modified (304). ETag:", lastEtagRef.current);
            } else if (response.data && Array.isArray(response.data)) {
                console.log(`[fetchOrderMonitor] Data received (${response.data.length} items). New ETag from metadata:`, response.metadata?.headers?.etag);
                const allOrders = response.data;

                const newOrdersByStatus = { created: [], delivering: [], completed: [] };
                allOrders.forEach(order => {
                    const statusKey = Object.keys(STATUS_MAP).find(key => STATUS_MAP[key] === order.status);
                    if (statusKey && newOrdersByStatus[statusKey]) {
                        newOrdersByStatus[statusKey].push(order);
                    } else {
                        console.warn(`[fetchOrderMonitor] Order ${order.id} status "${order.status}" not in STATUS_MAP. Defaulting to 'created'.`);
                        newOrdersByStatus.created.push(order);
                    }
                });
                console.log('[fetchOrderMonitor] Categorized orders:', JSON.stringify(newOrdersByStatus, null, 2));

                if (!activeIdRef.current && pendingUpdatesRef.current.length === 0) { // Re-check condition before setting state
                    setOrdersByStatus(newOrdersByStatus);
                    setRawBills(allOrders);
                    console.log('[fetchOrderMonitor] State for ordersByStatus and rawBills updated.');

                    const newEtag = response.metadata?.headers?.etag;
                    if (newEtag) {
                        console.log('[fetchOrderMonitor] Updating ETag to:', newEtag);
                        lastEtagRef.current = newEtag;
                    }
                } else {
                     console.log('[fetchOrderMonitor] State update skipped due to activeId or pendingUpdates after data fetch.');
                }
            } else {
                console.log("[fetchOrderMonitor] Received response with no valid data (or empty data array) and not a 304. Clearing displayed data.");
                setRawBills([]);
                setOrdersByStatus({ created: [], delivering: [], completed: [] });
                const newEtag = response.metadata?.headers?.etag;
                if (newEtag) lastEtagRef.current = newEtag;
                else if (lastEtagRef.current !== null) lastEtagRef.current = null; // Clear etag if server stops sending one for empty
            }
        } catch (err) {
            console.error('[fetchOrderMonitor] Failed to fetch or process orders:', err);
            if (err.status === 401 || err.status === 403) {
                lastEtagRef.current = null; // Clear ETag on auth errors to force full fetch next time.
            }
            // Optionally, set an error state to display to the user
            // setErrorState(err.message || 'Failed to load orders');
        } finally {
            setIsFetching(false);
        }
    // Empty dependency array because we rely on refs for mutable values
    }, []);

    useEffect(() => {
        console.log('[MainLayout] Component mounted/fetchOrderMonitor changed. Initial fetch and setting up interval.');
        fetchOrderMonitor();
        const interval = setInterval(fetchOrderMonitor, POLLING_INTERVALS.monitor);
        return () => {
            console.log('[MainLayout] Component unmounting. Clearing interval.');
            clearInterval(interval);
        };
    }, []);

    // --- Pending Updates Sync Effect ---
    useEffect(() => {
        if (pendingUpdates.length === 0) return;
        const [updateToSync, ...restOfQueue] = pendingUpdates;
        const { id, status } = updateToSync;
        const timer = setTimeout(async () => {
            try {
                await request(`/orders/${id}`, 'PUT', { status });
                console.log(`Synced status successfully: Order ${id} -> ${status}`);
            } catch (err) {
                console.error(`Failed to sync order ${id} to ${status}. Status: ${err.status}, Message: ${err.message || err}`);
                // Optionally, handle retry or notify user
            } finally {
                setPendingUpdates(restOfQueue);
            }
        }, SYNC_DEBOUNCE_TIME);
        return () => clearTimeout(timer);
    }, [pendingUpdates, /* setPendingUpdates is stable */]);


    // --- DND Sensors ---
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }));

    // --- Callback Handlers ---
    const handleDriverChange = useCallback(async (orderId, driverName) => {
        console.log(`Attempting to update driver for order ${orderId} to "${driverName}"`);
        const updateFunc = (o) => String(o.id) === String(orderId) ? { ...o, driverName } : o;
        setOrdersByStatus(prev => ({ created: (prev.created || []).map(updateFunc), delivering: (prev.delivering || []).map(updateFunc), completed: (prev.completed || []).map(updateFunc) }));
        setRawBills(prev => prev.map(updateFunc));
        try {
            await request(`/orders/${orderId}`, 'PUT', { driverName });
            console.log(`Successfully updated driver for order ${orderId}`);
            lastEtagRef.current = null; // Invalidate ETag
        } catch (e) {
            console.error(`Failed to update driver for order ${orderId}:`, e.message || e);
            // Consider reverting optimistic update or showing an error message
        }
    }, [/* setOrdersByStatus and setRawBills are stable */]);

    const handleMonitorSearchChange = useCallback((columnId, value) => {
        setSearchTerms(prev => ({ ...prev, [columnId]: value }));
    }, [/* setSearchTerms is stable */]);

    const handleOrderCreated = useCallback((newlyCreatedOrder) => {
        if (!newlyCreatedOrder?.id || !newlyCreatedOrder.status) {
            console.error("Optimistic update failed: Invalid new order data.", newlyCreatedOrder);
            return;
        }
        console.log(`[handleOrderCreated] New order: ${newlyCreatedOrder.id}, Status: ${newlyCreatedOrder.status}`);
        const targetStatus = newlyCreatedOrder.status;
        const targetColumn = Object.keys(STATUS_MAP).find(key => STATUS_MAP[key] === targetStatus) || 'created';

        setOrdersByStatus(prev => {
            const columnOrders = Array.isArray(prev[targetColumn]) ? prev[targetColumn] : [];
            if (columnOrders.some(o => String(o.id) === String(newlyCreatedOrder.id))) return prev; // Avoid duplicates
            return { ...prev, [targetColumn]: [newlyCreatedOrder, ...columnOrders] };
        });
        setRawBills(prev => {
            if (prev.some(o => String(o.id) === String(newlyCreatedOrder.id))) return prev; // Avoid duplicates
            return [newlyCreatedOrder, ...prev];
        });
        console.log(`Optimistically updated monitor/bills for order ${newlyCreatedOrder.id}.`);
        lastEtagRef.current = null; // Invalidate ETag
    }, [/* setOrdersByStatus, setRawBills and STATUS_MAP are stable */]);

    const handlePaymentTypeChange = useCallback(async (orderId, newPaymentType) => {
        console.log(`Attempting to update payment type for order ${orderId} to "${newPaymentType}"`);
        const updateFunc = (o) => String(o.id) === String(orderId) ? { ...o, paymentType: newPaymentType } : o;
        setOrdersByStatus(prev => ({ created: (prev.created || []).map(updateFunc), delivering: (prev.delivering || []).map(updateFunc), completed: (prev.completed || []).map(updateFunc) }));
        setRawBills(prev => prev.map(updateFunc));
        try {
            await request(`/orders/${orderId}`, 'PUT', { paymentType: newPaymentType });
            console.log(`Successfully updated payment type for order ${orderId}`);
            lastEtagRef.current = null; // Invalidate ETag
        } catch (e) {
            console.error(`Failed to update payment type for order ${orderId}:`, e.message || e);
        }
    }, [/* setOrdersByStatus and setRawBills are stable */]);

    // --- Drag and Drop Handlers ---
    const handleDragStart = useCallback((event) => {
        const { active } = event;
        setActiveId(active.id);
        setActiveOrderData(active.data.current?.order || null);
    }, [/* setActiveId, setActiveOrderData are stable */]);

    const handleDragOver = useCallback((event) => {
        // Simplified: This logic reorders visually within the same column during drag.
        // Full cross-column reordering during drag_over is complex and often deferred to drag_end.
        const { active, over } = event;
        if (!over || !activeId || !active.data.current?.parentId) return;

        const activeIdStr = String(active.id);
        const overIdStr = String(over.id);
        const activeContainer = active.data.current.parentId;
        let overContainer = null;

        if (over.data.current?.type === 'column') {
            overContainer = over.id;
        } else if (over.data.current?.type === 'order') {
            overContainer = over.data.current.parentId;
        } else if (VALID_TARGET_COLUMNS.includes(over.id)) {
            overContainer = over.id;
        }

        if (!overContainer || !VALID_TARGET_COLUMNS.includes(overContainer)) return;

        if (activeContainer === overContainer) {
            if (over.data.current?.type === 'order' && activeIdStr !== overIdStr) {
                setOrdersByStatus((prev) => {
                    const items = prev[activeContainer] || [];
                    const activeIndex = items.findIndex(item => String(item.id) === activeIdStr);
                    const overIndex = items.findIndex(item => String(item.id) === overIdStr);
                    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
                        return { ...prev, [activeContainer]: arrayMove(items, activeIndex, overIndex) };
                    }
                    return prev;
                });
            }
        }
        // For actual data move between columns, this is typically handled in onDragEnd for simplicity.
        // To preview move, you'd update active.data.current.parentId = overContainer; here.
    }, [activeId, /* setOrdersByStatus is stable */]);


    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        const orderData = active.data.current?.order;

        setActiveId(null); // Clear active drag state first
        setActiveOrderData(null);

        if (!active.id || !orderData) {
            console.log("DragEnd: No active ID or orderData, exiting.");
            return;
        }

        const orderId = String(active.id);
        const originalStatus = orderData.status;
        const originalColumnId = Object.keys(STATUS_MAP).find(key => STATUS_MAP[key] === originalStatus);

        let finalContainerId = null;
        if (over) {
            if (over.data.current?.type === 'column') finalContainerId = over.id;
            else if (over.data.current?.type === 'order') finalContainerId = over.data.current.parentId;
            else if (VALID_TARGET_COLUMNS.includes(over.id)) finalContainerId = over.id;
        }

        // If not dropped on a valid container, or dropped on original container without actual change, revert or do nothing.
        if (!finalContainerId || !VALID_TARGET_COLUMNS.includes(finalContainerId) || finalContainerId === originalColumnId) {
            console.log("DragEnd: No valid drop target or no change in column. ID:", orderId, "Orig:", originalColumnId, "Final:", finalContainerId);
            // If it was only reordered visually within the same column by handleDragOver, that's fine.
            // If it was dragged off and back, no actual status change.
            return;
        }

        const finalStatus = STATUS_MAP[finalContainerId];
        console.log(`DragEnd: Order ${orderId} from ${originalColumnId} (${originalStatus}) to ${finalContainerId} (${finalStatus})`);

        // Optimistic update
        let itemToMoveGlobal = null;
        setOrdersByStatus(prev => {
            if (!originalColumnId || !prev[originalColumnId]) {
                console.error("DragEnd: Original column or items not found in state.", originalColumnId, prev);
                return prev; // Should not happen if orderData was valid
            }
            const sourceItems = [...prev[originalColumnId]];
            const destinationItems = [...(prev[finalContainerId] || [])];
            const itemIndex = sourceItems.findIndex(item => String(item.id) === orderId);

            if (itemIndex === -1) {
                console.error(`DragEnd: Item ${orderId} not found in source column ${originalColumnId}. This might indicate a state sync issue.`);
                // Attempt to find it in any column if something went wrong with optimistic updates during drag_over
                // This is a fallback, ideally itemIndex should be found.
                for (const colId of VALID_TARGET_COLUMNS) {
                    const potentialIndex = (prev[colId] || []).findIndex(item => String(item.id) === orderId);
                    if (potentialIndex !== -1 && colId !== finalContainerId) { // Ensure we are not "moving" from and to the same if found elsewhere
                        console.warn(`DragEnd: Item ${orderId} found in unexpected column ${colId} instead of ${originalColumnId}. Adjusting source.`);
                        sourceItems.splice(0, sourceItems.length, ...prev[colId]); // Replace sourceItems
                        // originalColumnId = colId; // Update for correct removal, though this complicates logic. For now, just ensure it's removed.
                        const foundItemIndex = sourceItems.findIndex(item => String(item.id) === orderId);
                        if (foundItemIndex !== -1) {
                            const [itemToMove] = sourceItems.splice(foundItemIndex, 1);
                            itemToMoveGlobal = { ...itemToMove, status: finalStatus, statusUpdatedAt: new Date().toISOString() };
                            destinationItems.push(itemToMoveGlobal);
                            return { ...prev, [colId]: sourceItems, [finalContainerId]: destinationItems };
                        }
                        break; // Found and processed or failed to process
                    }
                }
                return prev; // If still not found after trying fallback.
            }

            const [itemToMove] = sourceItems.splice(itemIndex, 1);
            itemToMoveGlobal = { ...itemToMove, status: finalStatus, statusUpdatedAt: new Date().toISOString() }; // Update status and timestamp
            destinationItems.push(itemToMoveGlobal);

            return { ...prev, [originalColumnId]: sourceItems, [finalContainerId]: destinationItems };
        });

        if (itemToMoveGlobal) {
            setRawBills(prev => prev.map(bill => String(bill.id) === orderId ? itemToMoveGlobal : bill));
        }

        setPendingUpdates((queue) => {
            // Avoid queuing multiple updates for the same order to the same status
            const existingUpdateIndex = queue.findIndex(p => String(p.id) === orderId);
            if (existingUpdateIndex !== -1) {
                if (queue[existingUpdateIndex].status === finalStatus) return queue; // Already queued for this status
                const updatedQueue = [...queue];
                updatedQueue[existingUpdateIndex] = { id: orderId, status: finalStatus }; // Update existing entry
                return updatedQueue;
            }
            return [...queue, { id: orderId, status: finalStatus }];
        });
        lastEtagRef.current = null; // Invalidate ETag

    }, [/* Dependencies: setOrdersByStatus, setRawBills, setPendingUpdates, STATUS_MAP, VALID_TARGET_COLUMNS. */]);


    const handleDragCancel = useCallback(() => {
        setActiveId(null);
        setActiveOrderData(null);
        fetchOrderMonitor(); // Refetch to ensure consistency
    }, [fetchOrderMonitor, /* setActiveId, setActiveOrderData are stable */]);


    // --- Render JSX ---
    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; overflow-y: auto; }`}</style>
            <div style={{ display: 'flex', height: '100vh', fontFamily: 'Prompt, sans-serif', background: '#f0f2f5' }}>

                {/* Right column: Order Monitor -> Now Left Column 21.04 */}
                <div style={{ flex: 1, padding: '20px', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontWeight: 'bold', fontSize: '1.3rem', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #ddd', flexShrink: 0 }}>ติดตามคำสั่งซื้อ & มอบหมายงาน</h2>
                    <div style={{ display: 'flex', flexGrow: 1, gap: '10px', overflowY: 'hidden' }}>
                        <MonitorColumn title="🆕 รอมอบหมาย" orders={ordersByStatus.created} columnId="created" searchTerm={searchTerms.created} onSearchChange={handleMonitorSearchChange} onDriverChange={handleDriverChange} onPaymentTypeChange={handlePaymentTypeChange} />
                        <MonitorColumn title="🚚 กำลังจัดส่ง" orders={ordersByStatus.delivering} columnId="delivering" searchTerm={searchTerms.delivering} onSearchChange={handleMonitorSearchChange} onDriverChange={handleDriverChange} onPaymentTypeChange={handlePaymentTypeChange} />
                        <MonitorColumn title="✅ เสร็จสิ้น" orders={ordersByStatus.completed} columnId="completed" searchTerm={searchTerms.completed} onSearchChange={handleMonitorSearchChange} onDriverChange={handleDriverChange} onPaymentTypeChange={handlePaymentTypeChange} />
                    </div>
                </div>

                {/* Left column -> Now Right Column 21.04 */}
                <div style={{ width: '440px', display: 'flex', flexDirection: 'column', borderRight: '2px solid #ccc', background: '#fff', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}>
                    {isNewOrderVisible && ( <div style={{ padding: '3px', borderBottom: '1px solid #eee', flexShrink: 0 }}> <NewOrder onOrderCreated={handleOrderCreated} /> </div> )}
                    <div style={{ padding: '8px 15px 0px 15px', borderBottom: '1px solid #eee', flexShrink: 0 }}> <button onClick={() => setIsNewOrderVisible(prev => !prev)} style={{ width: '100%', padding: '4px 8px', marginBottom: '10px', fontSize: '0.85em', fontWeight: 'bold', color: '#444', background: '#e8e8e8', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }} aria-expanded={isNewOrderVisible} > {isNewOrderVisible ? '➖ ซ่อนฟอร์มออกบิล' : '➕ แสดงฟอร์มออกบิล'} </button> </div>
                    <BillsList billsData={rawBills} />
                </div>

            </div>

            <DragOverlay dropAnimation={null}>
                {activeId && activeOrderData ? ( <MemoizedDraggableOrder order={activeOrderData} parentId={null} isOverlay={true} onDriverChange={() => {}} onPaymentTypeChange={() => {}} /> ) : null}
            </DragOverlay>
        </DndContext>
    );
}