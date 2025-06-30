// src/salesops/SalesEntryGrid.jsx - Simplified version with pricing support
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    draggable, 
    dropTargetForElements,
    monitorForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { useVirtualizer } from '@tanstack/react-virtual';
import { apiService } from '../apiService';
import { 
    ArrowPathIcon, 
    MagnifyingGlassIcon,
    XMarkIcon,
    Bars3Icon,
    PlusIcon,
    TrashIcon,
    PencilIcon,
    CheckIcon
} from '../components/Icons';
import debounce from 'lodash/debounce';

// Customer Search Component (same as before)
const CustomerSearchInput = ({ value, onChange, onSelect, onClear, placeholder = "ค้นหาลูกค้า..." }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef(null);

    const debouncedSearch = useMemo(
        () => debounce(async (searchTerm) => {
            if (!searchTerm || searchTerm.length < 2) {
                setSearchResults([]);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                const response = await apiService.get(`/customers/search?search=${encodeURIComponent(searchTerm)}&limit=10`);
                setSearchResults(response);
                setShowDropdown(true);
            } catch (error) {
                console.error('Customer search error:', error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300),
        []
    );

    useEffect(() => {
        debouncedSearch(value);
        return () => debouncedSearch.cancel();
    }, [value, debouncedSearch]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={searchRef} className="relative">
            <div className="relative">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                {isSearching && (
                    <ArrowPathIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
                {value && !isSearching && (
                    <button
                        onClick={onClear}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    >
                        <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </button>
                )}
            </div>
            
            {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {searchResults.map((customer) => (
                        <button
                            key={customer.customer_id}
                            onClick={() => {
                                onSelect(customer);
                                setShowDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                        >
                            <div className="text-sm font-medium text-gray-900">
                                {customer.customer_name}
                            </div>
                            {customer.current_routes && customer.current_routes.length > 0 && (
                                <div className="text-xs text-gray-500">
                                    เส้นทาง: {customer.current_routes.join(', ')}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// Price Edit Component
const PriceEditCell = ({ value, isCustomPrice, onSave, disabled }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editValue !== value) {
            onSave(editValue);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setEditValue(value);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center space-x-1">
                <input
                    ref={inputRef}
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="w-16 px-1 py-0.5 text-sm border border-indigo-500 rounded"
                    disabled={disabled}
                />
                <CheckIcon className="w-3 h-3 text-green-600" />
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-1">
            <span className={`text-sm ${isCustomPrice ? 'font-medium text-indigo-600' : 'text-gray-600'}`}>
                ฿{value}
            </span>
            {!disabled && (
                <button
                    onClick={() => setIsEditing(true)}
                    className="p-0.5 hover:bg-gray-100 rounded"
                    title="แก้ไขราคา"
                >
                    <PencilIcon className="w-3 h-3 text-gray-400" />
                </button>
            )}
        </div>
    );
};

// Draggable Row Component
const VirtualizedRow = ({ 
    virtualItem, 
    salesData, 
    products, 
    customerPrices,
    handleInputChange, 
    handleCustomerFieldChange,
    handleCustomerSelect,
    handlePriceUpdate,
    handleRemoveRow,
    dragState, 
    onDragStart, 
    onDragEnd 
}) => {
    const rowData = salesData[virtualItem.index];
    const { id, customer_id, customer_name, items, payment_type, notes, search_query } = rowData;
    const rowRef = useRef(null);
    const dragHandleRef = useRef(null);
    const [isDraggedOver, setIsDraggedOver] = useState(false);
    const isBeingDragged = dragState.isDragging && dragState.id === id;

    useEffect(() => {
        const el = rowRef.current;
        const handle = dragHandleRef.current;
        if (!el || !handle) return;

        return combine(
            draggable({
                element: el,
                dragHandle: handle,
                getInitialData: () => ({ 
                    type: 'sales-row',
                    id, 
                    index: virtualItem.index 
                }),
                onDragStart: () => onDragStart(id),
                onDrop: () => onDragEnd(),
            }),
            dropTargetForElements({
                element: el,
                getData: () => ({ index: virtualItem.index }),
                onDragEnter: () => setIsDraggedOver(true),
                onDragLeave: () => setIsDraggedOver(false),
                onDrop: () => setIsDraggedOver(false),
                canDrop: ({ source }) => source.data.type === 'sales-row'
            })
        );
    }, [id, virtualItem.index, onDragStart, onDragEnd]);

    return (
        <tr
            ref={rowRef}
            style={{
                opacity: isBeingDragged ? 0.5 : 1,
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translateY(${virtualItem.start}px)`,
                width: '100%',
                transition: isBeingDragged ? 'none' : 'transform 0.2s',
            }}
            className={`
                ${isBeingDragged ? 'bg-blue-50' : 'bg-white'} 
                ${isDraggedOver ? 'bg-indigo-50' : ''}
                hover:bg-gray-50 border-b border-gray-200
            `}
        >
            <td className="px-2 py-2 whitespace-nowrap">
                <div className="flex items-center space-x-1">
                    <div
                        ref={dragHandleRef}
                        className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded"
                    >
                        <Bars3Icon className="w-4 h-4 text-gray-400" />
                    </div>
                    <button
                        onClick={() => handleRemoveRow(virtualItem.index)}
                        className="p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-700"
                        title="ลบแถว"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </td>
            <td className="px-3 py-2">
                {customer_id ? (
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">{customer_name}</span>
                        <button
                            onClick={() => handleCustomerSelect(virtualItem.index, null)}
                            className="text-xs text-gray-500 hover:text-red-600"
                        >
                            เปลี่ยน
                        </button>
                    </div>
                ) : (
                    <CustomerSearchInput
                        value={search_query || ''}
                        onChange={(value) => handleCustomerFieldChange(virtualItem.index, 'search_query', value)}
                        onSelect={(customer) => handleCustomerSelect(virtualItem.index, customer)}
                        onClear={() => handleCustomerFieldChange(virtualItem.index, 'search_query', '')}
                        placeholder="พิมพ์เพื่อค้นหาลูกค้า..."
                    />
                )}
            </td>
            {products.map((product) => {
                const item = items.find(i => i.product_id === product.product_id) || {};
                const customerPrice = customerPrices[customer_id]?.find(p => p.product_id === product.product_id);
                const currentPrice = item.unit_price || customerPrice?.unit_price || product.default_unit_price || '0.00';
                const isCustomPrice = customerPrice?.is_custom_price || false;

                return (
                    <td key={product.product_id} className="px-3 py-2">
                        <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={item.quantity_sold || ''}
                                    onChange={(e) => handleInputChange(virtualItem.index, product.product_id, 'quantity_sold', e.target.value)}
                                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                    disabled={!customer_id}
                                />
                                <select
                                    value={item.transaction_type || 'Sale'}
                                    onChange={(e) => handleInputChange(virtualItem.index, product.product_id, 'transaction_type', e.target.value)}
                                    className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                                    disabled={!customer_id}
                                >
                                    <option value="Sale">ขาย</option>
                                    <option value="Giveaway">แจก</option>
                                </select>
                            </div>
                            <PriceEditCell
                                value={currentPrice}
                                isCustomPrice={isCustomPrice}
                                onSave={(newPrice) => handlePriceUpdate(customer_id, product.product_id, newPrice)}
                                disabled={!customer_id || item.transaction_type === 'Giveaway'}
                            />
                        </div>
                    </td>
                )})}
            <td className="px-3 py-2">
                <select 
                    value={payment_type} 
                    onChange={(e) => handleCustomerFieldChange(virtualItem.index, 'payment_type', e.target.value)} 
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                    disabled={!customer_id}
                >
                    <option value="Cash">เงินสด</option>
                    <option value="Credit">เครดิต</option>
                    <option value="Debit">เดบิต</option>
                </select>
            </td>
            <td className="px-3 py-2">
                <input
                    type="text"
                    placeholder="หมายเหตุ..."
                    value={notes || ''}
                    onChange={(e) => handleCustomerFieldChange(virtualItem.index, 'notes', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                    disabled={!customer_id}
                />
            </td>
        </tr>
    );
};

// Main Grid Component
const SalesEntryGrid = ({ summary, products, onSaveSuccess, onOrderChange, editMode = false }) => {
    const [salesData, setSalesData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [dragState, setDragState] = useState({ isDragging: false, id: null });
    const [customerPrices, setCustomerPrices] = useState({});
    const parentRef = useRef(null);
    const orderSaveTimeoutRef = useRef(null);

    // Load existing data or start fresh
    useEffect(() => {
        const initializeGrid = async () => {
            if (!summary?.summary_id || !products || products.length === 0) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                // Load existing sales if in edit mode
                if (editMode) {
                    const response = await apiService.get(`/sales-ops/driver-sales/edit/${summary.summary_id}`);
                    const gridData = response.sales.map((sale, index) => ({
                        id: `sale-${sale.sale_id}`,
                        sale_id: sale.sale_id,
                        customer_id: sale.customer_id,
                        customer_name: sale.customer_name,
                        payment_type: sale.payment_type,
                        notes: sale.notes || '',
                        search_query: '',
                        items: products.map(product => {
                            const existingItem = sale.items?.find(i => i.product_id === product.product_id);
                            return {
                                product_id: product.product_id,
                                quantity_sold: existingItem?.quantity_sold || '',
                                unit_price: existingItem?.unit_price || product.default_unit_price || '0.00',
                                transaction_type: existingItem?.transaction_type || 'Sale',
                            };
                        })
                    }));
                    setSalesData(gridData);

                    // Load customer prices
                    const pricePromises = gridData.map(row => 
                        row.customer_id ? loadCustomerPrices(row.customer_id) : Promise.resolve()
                    );
                    await Promise.all(pricePromises);
                } else {
                    // Fresh sales entry - get customers from route
                    const response = await apiService.get(`/routes/${summary.route_id}/customers`);
                    
                    if (response.customers && response.customers.length > 0) {
                        const gridData = response.customers.map((customer, index) => ({
                            id: `customer-${customer.customer_id}-${Date.now()}`,
                            customer_id: customer.customer_id,
                            customer_name: customer.customer_name,
                            payment_type: 'Cash',
                            notes: '',
                            search_query: '',
                            items: products.map(product => ({
                                product_id: product.product_id,
                                quantity_sold: '',
                                unit_price: product.default_unit_price || '0.00',
                                transaction_type: 'Sale'
                            }))
                        }));
                        setSalesData(gridData);

                        // Load all customer prices
                        const pricePromises = gridData.map(row => loadCustomerPrices(row.customer_id));
                        await Promise.all(pricePromises);
                    } else {
                        // Start with empty rows
                        setSalesData(createEmptyRows(5));
                    }
                }
            } catch (err) {
                console.error("Failed to initialize sales grid:", err);
                setError("Failed to initialize: " + err.message);
            } finally {
                setIsLoading(false);
            }
        };

        initializeGrid();
    }, [summary, products, editMode]);

    // Helper function to create empty rows
    const createEmptyRows = (count) => {
        return Array.from({ length: count }, (_, i) => ({
            id: `new-${Date.now()}-${i}`,
            customer_id: null,
            customer_name: '',
            payment_type: 'Cash',
            notes: '',
            search_query: '',
            items: products.map(product => ({
                product_id: product.product_id,
                quantity_sold: '',
                unit_price: product.default_unit_price || '0.00',
                transaction_type: 'Sale'
            }))
        }));
    };

    // Load customer prices
    const loadCustomerPrices = async (customerId) => {
        if (!customerId) return;
        
        try {
            const response = await apiService.get(`/customers/${customerId}/prices`);
            setCustomerPrices(prev => ({
                ...prev,
                [customerId]: response.prices
            }));
        } catch (err) {
            console.error(`Failed to load prices for customer ${customerId}:`, err);
        }
    };

    // Setup drag and drop
    useEffect(() => {
        const el = parentRef.current;
        if (!el) return;

        return combine(
            monitorForElements({
                onDrop({ source, location }) {
                    const destination = location.current.dropTargets[0];
                    if (!destination) return;

                    const sourceIndex = source.data.index;
                    const destinationIndex = destination.data.index;

                    if (sourceIndex !== undefined && destinationIndex !== undefined) {
                        setSalesData(current => {
                            const newData = reorder(current, sourceIndex, destinationIndex);
                            scheduleOrderSave(newData);
                            return newData;
                        });
                    }
                }
            }),
            autoScrollForElements({
                element: el
            })
        );
    }, []);

    // Schedule order save
    const scheduleOrderSave = useCallback((newData) => {
        if (orderSaveTimeoutRef.current) {
            clearTimeout(orderSaveTimeoutRef.current);
        }

        orderSaveTimeoutRef.current = setTimeout(() => {
            const customerIds = newData
                .filter(row => row.customer_id)
                .map(row => row.customer_id);
            
            if (onOrderChange && customerIds.length > 0) {
                onOrderChange(customerIds);
            }
        }, 5000);
    }, [onOrderChange]);

    // Virtualization
    const rowVirtualizer = useVirtualizer({
        count: salesData.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 80,
        overscan: 10,
    });

    // Handlers
    const handleCustomerSelect = useCallback(async (index, customer) => {
        setSalesData(current => {
            const newData = [...current];
            if (customer) {
                newData[index] = {
                    ...newData[index],
                    customer_id: customer.customer_id,
                    customer_name: customer.customer_name,
                    search_query: ''
                };
                // Load customer prices
                loadCustomerPrices(customer.customer_id);
            } else {
                newData[index] = {
                    ...newData[index],
                    customer_id: null,
                    customer_name: '',
                    search_query: ''
                };
            }
            return newData;
        });
    }, []);

    const handlePriceUpdate = useCallback(async (customerId, productId, newPrice) => {
        if (!customerId || !productId) return;

        try {
            await apiService.put(`/customers/${customerId}/prices/${productId}`, {
                unit_price: newPrice,
                reason: 'Updated during sales entry'
            });

            // Update local price cache
            await loadCustomerPrices(customerId);

            // Update the price in current data
            setSalesData(current => {
                return current.map(row => {
                    if (row.customer_id === customerId) {
                        const updatedItems = row.items.map(item => {
                            if (item.product_id === productId) {
                                return { ...item, unit_price: newPrice };
                            }
                            return item;
                        });
                        return { ...row, items: updatedItems };
                    }
                    return row;
                });
            });
        } catch (err) {
            console.error('Failed to update price:', err);
            setError('Failed to update price');
        }
    }, []);

    const handleAddRow = useCallback(() => {
        setSalesData(current => [...current, ...createEmptyRows(1)]);
    }, [products]);

    const handleRemoveRow = useCallback((index) => {
        setSalesData(current => current.filter((_, i) => i !== index));
    }, []);

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

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        
        const salesToSave = salesData
            .filter(sale => sale.customer_id)
            .map(sale => ({
                sale_id: sale.sale_id, // Include if editing
                customer_id: sale.customer_id,
                payment_type: sale.payment_type,
                notes: sale.notes,
                items: sale.items.filter(item => item.quantity_sold && parseFloat(item.quantity_sold) > 0)
            }))
            .filter(sale => sale.items.length > 0);

        if (salesToSave.length === 0) {
            setError("ไม่มีข้อมูลการขายที่จะบันทึก");
            setIsSaving(false);
            return;
        }

        try {
            if (editMode) {
                // Update existing sales
                for (const sale of salesToSave) {
                    if (sale.sale_id) {
                        await apiService.put(`/sales-ops/driver-sales/${sale.sale_id}`, {
                            payment_type: sale.payment_type,
                            notes: sale.notes,
                            items: sale.items
                        });
                    }
                }
            } else {
                // Create new sales
                await apiService.post('/sales-ops/sales-entry/batch', {
                    driver_daily_summary_id: summary.summary_id,
                    sales_data: salesToSave
                });
            }
            
            onSaveSuccess();
        } catch (err) {
            setError("Failed to save: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Helper function to reorder
    const reorder = (list, startIndex, endIndex) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };

    // Render
    return (
        <div className="bg-white rounded-lg shadow-sm">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {editMode ? 'แก้ไขข้อมูลการขาย' : 'บันทึกการขาย'}
                    </h3>
                    <button
                        onClick={handleAddRow}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        <PlusIcon className="w-4 h-4 mr-1" />
                        เพิ่มแถว
                    </button>
                </div>
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center p-10 text-gray-500">
                    <ArrowPathIcon className="w-6 h-6 animate-spin mr-3"/> กำลังโหลดข้อมูล...
                </div>
            ) : (
                <>
                    <div 
                        ref={parentRef} 
                        className="overflow-auto border-b border-gray-200" 
                        style={{ 
                            maxHeight: '60vh',
                            minHeight: '400px',
                            contain: 'strict' 
                        }}
                    >
                        <table className="min-w-full relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                                        
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[250px]">
                                        ลูกค้า
                                    </th>
                                    {products.map(p => (
                                        <th key={p.product_id} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                                            {p.product_name}
                                        </th>
                                    ))}
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                                        การชำระเงิน
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                                        หมายเหตุ
                                    </th>
                                </tr>
                            </thead>
                            <tbody style={{ position: 'relative' }}>
                                {rowVirtualizer.getVirtualItems().map(virtualItem => (
                                    <VirtualizedRow
                                        key={virtualItem.key}
                                        virtualItem={virtualItem}
                                        salesData={salesData}
                                        products={products}
                                        customerPrices={customerPrices}
                                        handleInputChange={handleInputChange}
                                        handleCustomerFieldChange={handleCustomerFieldChange}
                                        handleCustomerSelect={handleCustomerSelect}
                                        handlePriceUpdate={handlePriceUpdate}
                                        handleRemoveRow={handleRemoveRow}
                                        dragState={dragState}
                                        onDragStart={(id) => setDragState({ isDragging: true, id })}
                                        onDragEnd={() => setDragState({ isDragging: false, id: null })}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4">
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                                {error}
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                                {salesData.filter(s => s.customer_id).length} ลูกค้า
                            </div>
                            <button 
                                type="button" 
                                onClick={handleSave} 
                                disabled={isSaving || isLoading} 
                                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving && <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin"/>}
                                {isSaving ? 'กำลังบันทึก...' : (editMode ? 'บันทึกการแก้ไข' : 'บันทึกการขาย')}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default SalesEntryGrid;