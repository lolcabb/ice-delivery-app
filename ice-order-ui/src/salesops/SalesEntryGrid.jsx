// ice-order-ui/src/salesops/SalesEntryGrid.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TrashIcon, PlusIcon, ArrowPathIcon } from '../components/Icons';
import { apiService } from '../apiService';

// --- Customer Search Component ---
const CustomerSearchInput = memo(({ onSelectCustomer, currentCustomers }) => {
    const [searchText, setSearchText] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const searchTimeoutRef = useRef(null);

    const handleSearch = useCallback(async (term) => {
        if (term.trim().length < 2) {
            setSuggestions([]);
            return;
        }
        setIsLoading(true);
        try {
            const response = await apiService.getCustomers({ search: term, limit: 10, is_active: true });
            const customers = response.data || [];
            const currentCustomerIds = new Set(currentCustomers.map(c => c.customer_id));
            setSuggestions(customers.filter(c => !currentCustomerIds.has(c.customer_id)));
        } catch (error) {
            console.error("Customer search failed:", error);
        } finally {
            setIsLoading(false);
        }
    }, [currentCustomers]);

    const handleInputChange = (e) => {
        const value = e.target.value;
        setSearchText(value);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => handleSearch(value), 300);
    };

    const handleSelect = (customer) => {
        onSelectCustomer(customer.customer_id);
        setSearchText('');
        setSuggestions([]);
    };

    return (
        <div className="relative">
            <input
                type="text"
                value={searchText}
                onChange={handleInputChange}
                placeholder="ค้นหาลูกค้าเพื่อเพิ่มในเส้นทาง..."
                className="w-full input-field"
            />
            {isLoading && <ArrowPathIcon className="w-5 h-5 text-gray-400 animate-spin absolute right-2 top-2.5" />}
            {suggestions.length > 0 && (
                <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map(customer => (
                        <li key={customer.customer_id} onMouseDown={() => handleSelect(customer)} className="px-3 py-2 hover:bg-indigo-50 cursor-pointer">
                            {customer.customer_name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
});

// Individual row component with drag support
const DraggableRow = React.memo(({ sale, products, onInputChange, onCustomerFieldChange, onRemoveRow, onAddSaleItem, onRemoveSaleItem }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sale.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <>
            {sale.items.map((item, itemIndex) => (
                <tr key={`${sale.id}-${item.product_id}-${itemIndex}`} ref={itemIndex === 0 ? setNodeRef : null} style={itemIndex === 0 ? style : {}} className="hover:bg-gray-50">
                    {/* Drag handle - only on first row */}
                    <td className="px-2 py-1 text-center">
                        {itemIndex === 0 && (
                            <div {...attributes} {...listeners} className="cursor-grab hover:cursor-grabbing p-1">
                                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                            </div>
                        )}
                    </td>
                    
                    {/* Customer name - only on first row, with rowspan */}
                    {itemIndex === 0 && (
                        <td className="px-3 py-1" rowSpan={sale.items.length}>
                            <div className="font-medium text-gray-900">{sale.customer_name}</div>
                        </td>
                    )}
                    
                    {/* Product selection */}
                    <td className="px-2 py-1">
                        <select 
                            value={item.product_id} 
                            onChange={e => onInputChange(sale.id, itemIndex, 'product_id', parseInt(e.target.value))}
                            className="input-field text-sm w-full"
                        >
                            <option value="">เลือกสินค้า</option>
                            {products.map(p => (
                                <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
                            ))}
                        </select>
                    </td>
                    
                    {/* Quantity */}
                    <td className="px-2 py-1">
                        <input 
                            type="number" 
                            min="0" 
                            step="0.01"
                            placeholder="จำนวน" 
                            value={item.quantity_sold || ''} 
                            onChange={e => onInputChange(sale.id, itemIndex, 'quantity_sold', e.target.value)}
                            className="input-field text-sm w-full text-center"
                        />
                    </td>
                    
                    {/* Unit Price */}
                    <td className="px-2 py-1">
                        <input 
                            type="number" 
                            min="0" 
                            step="0.01"
                            placeholder="ราคา/หน่วย" 
                            value={item.unit_price || ''} 
                            onChange={e => onInputChange(sale.id, itemIndex, 'unit_price', e.target.value)}
                            className="input-field text-sm w-full text-center"
                        />
                    </td>
                    
                    {/* Transaction Type */}
                    <td className="px-2 py-1">
                        <select 
                            value={item.transaction_type || 'Sale'} 
                            onChange={e => onInputChange(sale.id, itemIndex, 'transaction_type', e.target.value)}
                            className="input-field text-sm w-full"
                        >
                            <option value="Sale">ขาย</option>
                            <option value="Giveaway">แจก</option>
                            <option value="Internal Use">ใช้ภายใน</option>
                        </select>
                    </td>
                    
                    {/* Total for this item */}
                    <td className="px-2 py-1 text-center font-medium">
                        {item.quantity_sold && item.unit_price && item.transaction_type === 'Sale' 
                            ? (parseFloat(item.quantity_sold) * parseFloat(item.unit_price)).toFixed(2)
                            : item.transaction_type === 'Giveaway' ? '0.00' : ''
                        }
                    </td>
                    
                    {/* Payment type - only on first row */}
                    {itemIndex === 0 && (
                        <td className="px-2 py-1" rowSpan={sale.items.length}>
                            <select 
                                value={sale.payment_type || 'Cash'} 
                                onChange={e => onCustomerFieldChange(sale.id, 'payment_type', e.target.value)}
                                className="input-field text-sm w-full"
                            >
                                <option value="Cash">เงินสด</option>
                                <option value="Credit">เครดิต</option>
                            </select>
                        </td>
                    )}
                    
                    {/* Notes - only on first row */}
                    {itemIndex === 0 && (
                        <td className="px-2 py-1" rowSpan={sale.items.length}>
                            <input 
                                type="text" 
                                placeholder="หมายเหตุ..." 
                                value={sale.notes || ''} 
                                onChange={e => onCustomerFieldChange(sale.id, 'notes', e.target.value)} 
                                className="input-field text-sm w-full"
                            />
                        </td>
                    )}
                    
                    {/* Actions */}
                    <td className="px-2 py-1 text-center">
                        <div className="flex items-center justify-center space-x-1">
                            <button 
                                type="button" 
                                onClick={() => onRemoveSaleItem(sale.id, itemIndex)}
                                className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50"
                                title="ลบรายการนี้"
                            >
                                <TrashIcon className="w-4 h-4"/>
                            </button>
                            {itemIndex === sale.items.length - 1 && (
                                <button 
                                    type="button" 
                                    onClick={() => onAddSaleItem(sale.id)}
                                    className="text-green-500 hover:text-green-700 p-1 rounded-md hover:bg-green-50"
                                    title="เพิ่มรายการ"
                                >
                                    <PlusIcon className="w-4 h-4"/>
                                </button>
                            )}
                            {itemIndex === 0 && sale.items.length === 1 && (
                                <button 
                                    type="button" 
                                    onClick={() => onRemoveRow(sale.id)}
                                    className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50"
                                    title="ลบลูกค้า"
                                >
                                    <TrashIcon className="w-4 h-4"/>
                                </button>
                            )}
                        </div>
                    </td>
                </tr>
            ))}
        </>
    );
});

// Main Grid Component
function SalesEntryGrid({ summary, products, initialCustomers, onOrderChange, onAddCustomer, onRemoveCustomer, onSaveSuccess }) {
    const [salesData, setSalesData] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

    useEffect(() => {
        const gridData = initialCustomers.map(customer => ({
            id: customer.customer_id,
            customer_id: customer.customer_id,
            customer_name: customer.customer_name,
            payment_type: 'Cash',
            notes: '',
            items: [{
                product_id: '',
                quantity_sold: '',
                unit_price: '',
                transaction_type: 'Sale'
            }]
        }));
        setSalesData(gridData);
    }, [initialCustomers, products]);

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setSalesData(items => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);
                onOrderChange(newItems.map(item => item.customer_id));
                return newItems;
            });
        }
    };

    const handleInputChange = useCallback((customerId, itemIndex, field, value) => {
        setSalesData(current => current.map(sale => 
            sale.id === customerId 
                ? { 
                    ...sale, 
                    items: sale.items.map((item, idx) => 
                        idx === itemIndex ? { ...item, [field]: value } : item
                    ) 
                }
                : sale
        ));
    }, []);

    const handleCustomerFieldChange = useCallback((customerId, field, value) => {
        setSalesData(current => current.map(sale => sale.id === customerId ? { ...sale, [field]: value } : sale));
    }, []);

    const handleAddSaleItem = useCallback((customerId) => {
        setSalesData(current => current.map(sale => 
            sale.id === customerId 
                ? { 
                    ...sale, 
                    items: [...sale.items, {
                        product_id: '',
                        quantity_sold: '',
                        unit_price: '',
                        transaction_type: 'Sale'
                    }] 
                }
                : sale
        ));
    }, []);

    const handleRemoveSaleItem = useCallback((customerId, itemIndex) => {
        setSalesData(current => current.map(sale => 
            sale.id === customerId 
                ? { 
                    ...sale, 
                    items: sale.items.filter((_, idx) => idx !== itemIndex) 
                }
                : sale
        ));
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        
        // Filter and validate sales data
        const salesToSave = salesData
            .map(sale => ({
                ...sale,
                items: sale.items.filter(item => 
                    item.product_id && 
                    item.quantity_sold && 
                    parseFloat(item.quantity_sold) > 0 &&
                    item.unit_price &&
                    parseFloat(item.unit_price) >= 0
                )
            }))
            .filter(sale => sale.items.length > 0);
        
        if (salesToSave.length === 0) {
            setError("กรุณากรอกข้อมูลการขายอย่างน้อย 1 รายการ");
            setIsSaving(false);
            return;
        }

        try {
            await apiService.saveBatchSales({
                driver_daily_summary_id: summary.summary_id,
                sales_data: salesToSave
            });
            onSaveSuccess();
        } catch (err) {
            setError("ไม่สามารถบันทึกการขายได้: " + (err.data?.error || err.message));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="bg-white p-4 rounded-lg shadow">
                {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}
                
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <CustomerSearchInput onSelectCustomer={onAddCustomer} currentCustomers={salesData} />
                    <button onClick={handleSave} disabled={isSaving} className="btn-primary w-full md:w-auto justify-self-end">
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึกการขายทั้งหมด'}
                    </button>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="w-12"></th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">ลูกค้า</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[150px]">สินค้า</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[100px]">จำนวน</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[120px]">ราคา/หน่วย</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[120px]">ประเภท</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[100px]">ยอดรวม</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[130px]">การชำระเงิน</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[180px]">หมายเหตุ</th>
                                <th className="w-20">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            <SortableContext items={salesData.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                {salesData.map((sale) => (
                                    <DraggableRow
                                        key={sale.id}
                                        sale={sale}
                                        products={products}
                                        onInputChange={handleInputChange}
                                        onCustomerFieldChange={handleCustomerFieldChange}
                                        onRemoveRow={onRemoveCustomer}
                                        onAddSaleItem={handleAddSaleItem}
                                        onRemoveSaleItem={handleRemoveSaleItem}
                                    />
                                ))}
                            </SortableContext>
                        </tbody>
                    </table>
                </div>
            </div>
        </DndContext>
    );
}

export default SalesEntryGrid;
