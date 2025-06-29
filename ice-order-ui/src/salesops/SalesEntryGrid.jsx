// src/salesops/SalesEntryGrid.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { dropTargetForElements, draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useVirtualizer } from '@tanstack/react-virtual';
import { apiService } from '../apiService';
import { ArrowPathIcon } from '../components/Icons';

// Helper function to reorder the array after a drop
const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
};

// Draggable Row Component (Your original code is good)
const VirtualizedRow = ({ virtualItem, salesData, products, handleInputChange, handleCustomerFieldChange, dragState, onDragStart, onDragEnd }) => {
    const { id, customer_name, items, payment_type, notes } = salesData[virtualItem.index];
    const rowRef = useRef(null);
    const dragHandleRef = useRef(null);
    const isBeingDragged = dragState.isDragging && dragState.id === id;

    useEffect(() => {
        const el = rowRef.current;
        const handle = dragHandleRef.current;
        if (!el || !handle) return;

        return draggable({
            element: el,
            dragHandle: handle,
            getInitialData: () => ({ id, index: virtualItem.index }),
            onDragStart: () => onDragStart(id),
            onDrop: () => onDragEnd(),
        });
    }, [id, virtualItem.index, onDragStart, onDragEnd]);

    return (
        <tr
            ref={rowRef}
            style={{
                opacity: isBeingDragged ? 0.4 : 1,
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translateY(${virtualItem.start}px)`,
                width: '100%'
            }}
            className={isBeingDragged ? 'bg-blue-100' : 'bg-white'}
        >
            <td ref={dragHandleRef} className="px-2 py-2 whitespace-nowrap text-sm text-gray-400 cursor-grab text-center">☰</td>
            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{customer_name}</td>
            {products.map((product) => {
                 const item = items.find(i => i.product_id === product.product_id) || {};
                 return (
                    <td key={product.product_id} className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                            <input
                                type="number"
                                placeholder="จำนวน"
                                value={item.quantity_sold || ''}
                                onChange={(e) => handleInputChange(virtualItem.index, product.product_id, 'quantity_sold', e.target.value)}
                                className="w-20 input-field text-sm"
                            />
                            <select
                                value={item.transaction_type || 'Sale'}
                                onChange={(e) => handleInputChange(virtualItem.index, product.product_id, 'transaction_type', e.target.value)}
                                className="input-field text-xs"
                            >
                                <option value="Sale">ขาย</option>
                                <option value="Giveaway">แจกฟรี</option>
                            </select>
                        </div>
                    </td>
                )})}
            <td className="px-3 py-2 whitespace-nowrap">
                <select value={payment_type} onChange={(e) => handleCustomerFieldChange(virtualItem.index, 'payment_type', e.target.value)} className="input-field text-sm">
                    <option value="Cash">เงินสด</option>
                    <option value="Credit">เครดิต</option>
                    <option value="Debit">เดบิต</option>
                </select>
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
                <input
                    type="text"
                    placeholder="หมายเหตุการขาย..."
                    value={notes || ''}
                    onChange={(e) => handleCustomerFieldChange(virtualItem.index, 'notes', e.target.value)}
                    className="w-full input-field text-sm"
                />
            </td>
        </tr>
    );
};


// --- Main Grid Component ---
const SalesEntryGrid = ({ summary, products, onSaveSuccess }) => {
    const [salesData, setSalesData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [dragState, setDragState] = useState({ isDragging: false, id: null });
    const parentRef = useRef(null);

    // --- Drop Target Logic (Your original code is good) ---
    useEffect(() => {
        const el = parentRef.current;
        if (!el) return;

        return dropTargetForElements({
            element: el,
            onDrop: (args) => {
                const { source, location } = args;
                if (!location.current.dropTargets.length) return;
                const sourceIndex = source.data.index;
                const target = location.current.dropTargets[0];
                const targetIndex = target.data.index;
                if (sourceIndex === undefined || targetIndex === undefined) return;
                setSalesData(currentData => reorder(currentData, sourceIndex, targetIndex));
            },
        });
    }, []);

    const rowVirtualizer = useVirtualizer({
        count: salesData.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 65,
        overscan: 5,
    });

    // --- Data Initialization with FIX ---
    useEffect(() => {
        const initializeGrid = async () => {
            if (!summary?.summary_id || !products || products.length === 0) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);

            // FIX: Wrap the entire data fetching logic in a try...finally block
            try {
                // Fetch customers for the route
                const customerFilters = { route_id: summary.route_id, is_active: true, limit: 1000 };
                const customerResponse = await apiService.getCustomers(customerFilters);
                const routeCustomers = Array.isArray(customerResponse.data) ? customerResponse.data : [];
                const customerMap = new Map();
                routeCustomers.forEach(cust => customerMap.set(cust.customer_id, {
                    id: cust.customer_id, customer_id: cust.customer_id, customer_name: cust.customer_name
                }));

                // Fetch existing sales for the day to pre-fill the grid
                const salesResponse = await apiService.getDriverSales(summary.summary_id);
                const existingSales = Array.isArray(salesResponse) ? salesResponse : [];
                existingSales.forEach(sale => {
                    if (sale.customer_id && !customerMap.has(sale.customer_id)) {
                        customerMap.set(sale.customer_id, {
                            id: sale.customer_id, customer_id: sale.customer_id, customer_name: sale.actual_customer_name || `Customer ID ${sale.customer_id}`
                        });
                    }
                });
                
                const combinedCustomers = Array.from(customerMap.values());
                const gridData = combinedCustomers.map(customer => {
                    const existingCustomerSale = existingSales.find(s => s.customer_id === customer.customer_id);
                    return {
                        id: customer.id, customer_id: customer.customer_id, customer_name: customer.customer_name,
                        payment_type: existingCustomerSale?.payment_type || 'Cash',
                        notes: existingCustomerSale?.notes || '',
                        items: products.map(product => {
                            const existingItem = existingCustomerSale?.sale_items?.find(i => i.product_id === product.product_id);
                            return {
                                product_id: product.product_id,
                                quantity_sold: existingItem?.quantity_sold || '',
                                unit_price: existingItem?.unit_price || product.default_unit_price,
                                transaction_type: existingItem?.transaction_type || 'Sale',
                            };
                        })
                    };
                });
                setSalesData(gridData);
            } catch (err) {
                console.error("Failed to initialize sales grid:", err);
                setError("Failed to initialize sales grid: " + (err.data?.error || err.message));
            } finally {
                // This will run whether the try block succeeded or failed
                setIsLoading(false);
            }
        };

        initializeGrid();
    }, [summary, products]);

    // Input change handlers (Your original code is good)
    const handleInputChange = useCallback((customerIndex, productId, field, value) => {
        setSalesData(current => {
            const newData = [...current];
            const customerItems = newData[customerIndex].items;
            const itemIndex = customerItems.findIndex(i => i.product_id === productId);
            if (itemIndex > -1) {
                customerItems[itemIndex][field] = value;
                if (field === 'transaction_type' && value === 'Giveaway') {
                    customerItems[itemIndex]['unit_price'] = '0.00';
                }
            }
            return newData;
        });
    }, []);

    const handleCustomerFieldChange = useCallback((customerIndex, field, value) => {
        setSalesData(current => {
            const newData = [...current];
            newData[customerIndex] = { ...newData[customerIndex], [field]: value };
            return newData;
        });
    }, []);

    // Save handler (Your original code is good, but relies on the new apiService function)
    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        const salesToSave = salesData
            .map(sale => ({
                ...sale,
                items: sale.items.filter(item => item.quantity_sold && parseFloat(item.quantity_sold) > 0)
            }))
            .filter(sale => sale.items.length > 0);
        try {
            await apiService.saveBatchSales({
                driver_daily_summary_id: summary.summary_id,
                sales_data: salesToSave
            });
            onSaveSuccess();
        } catch (err) {
            setError("Failed to save sales. " + (err.data?.error || err.message));
        } finally {
            setIsSaving(false);
        }
    };

    // --- Render Logic (Your original code is good) ---
    return (
        <div>
            {isLoading ? (
                <div className="flex items-center justify-center p-10 text-gray-500">
                    <ArrowPathIcon className="w-6 h-6 animate-spin mr-3"/> Loading sales data...
                </div>
            ) : (
                <>
                    <div ref={parentRef} className="overflow-auto max-h-[70vh] border" style={{ contain: 'strict' }}>
                        <table className="min-w-full relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 w-8"></th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 min-w-[200px]">ลูกค้า</th>
                                    {products.map(p => (<th key={p.product_id} className="px-3 py-3 text-left text-xs font-medium text-gray-500 min-w-[210px]">{p.product_name}</th>))}
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 min-w-[150px]">ประเภทชำระเงิน</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 min-w-[200px]">หมายเหตุ</th>
                                </tr>
                            </thead>
                            <tbody style={{ position: 'relative' }}>
                                {rowVirtualizer.getVirtualItems().map(virtualItem => (
                                    <VirtualizedRow
                                        key={virtualItem.key}
                                        virtualItem={virtualItem}
                                        salesData={salesData}
                                        products={products}
                                        handleInputChange={handleInputChange}
                                        handleCustomerFieldChange={handleCustomerFieldChange}
                                        dragState={dragState}
                                        onDragStart={(id) => setDragState({ isDragging: true, id })}
                                        onDragEnd={() => setDragState({ isDragging: false, id: null })}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {error && <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}
                    <div className="flex justify-end space-x-3 pt-4 mt-4 border-t">
                        <button type="button" onClick={handleSave} disabled={isSaving || isLoading} className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                            {isSaving && <ArrowPathIcon className="w-5 h-5 mr-2 -ml-1 animate-spin"/>}
                            {isSaving ? 'กำลังบันทึก...' : 'บันทึกการขายทั้งหมด'}
                        </button>
                    </div>
                 </>
            )}
        </div>
    );
};

export default SalesEntryGrid;