import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { apiService } from '../apiService';
import { ArrowPathIcon, TrashIcon } from '../components/Icons';

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

// --- Draggable Row Component ---
const DraggableRow = memo(({ sale, products, onInputChange, onCustomerFieldChange, onRemoveRow }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sale.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
    };

    return (
        <tr ref={setNodeRef} style={style} {...attributes} className="bg-white">
            <td className="px-2 py-2 text-center text-gray-400 cursor-grab" {...listeners}>☰</td>
            <td className="px-3 py-2 text-sm font-medium text-gray-900">{sale.customer_name}</td>
            {products.map(product => {
                const item = sale.items.find(i => i.product_id === product.product_id) || {};
                return (
                    <td key={product.product_id} className="px-2 py-1">
                        <input
                            type="number"
                            placeholder="0"
                            min="0"
                            value={item.quantity_sold || ''}
                            onChange={e => onInputChange(sale.id, product.product_id, 'quantity_sold', e.target.value)}
                            className="w-24 input-field text-sm text-right"
                        />
                    </td>
                );
            })}
            <td className="px-2 py-1">
                <select value={sale.payment_type} onChange={e => onCustomerFieldChange(sale.id, 'payment_type', e.target.value)} className="input-field text-sm w-full">
                    <option value="Cash">เงินสด</option>
                    <option value="Credit">เครดิต</option>
                </select>
            </td>
            <td className="px-2 py-1">
                <input type="text" placeholder="หมายเหตุ..." value={sale.notes || ''} onChange={e => onCustomerFieldChange(sale.id, 'notes', e.target.value)} className="input-field text-sm w-full"/>
            </td>
            <td className="px-2 py-1 text-center">
                <button type="button" onClick={() => onRemoveRow(sale.id)} className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50">
                    <TrashIcon className="w-5 h-5"/>
                </button>
            </td>
        </tr>
    );
});

// --- Main Grid Component ---
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
            items: products.map(p => ({
                product_id: p.product_id,
                quantity_sold: '',
                unit_price: p.default_unit_price,
                transaction_type: 'Sale'
            }))
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

    const handleInputChange = useCallback((customerId, productId, field, value) => {
        setSalesData(current => current.map(sale => 
            sale.id === customerId 
                ? { ...sale, items: sale.items.map(item => item.product_id === productId ? { ...item, [field]: value } : item) }
                : sale
        ));
    }, []);

    const handleCustomerFieldChange = useCallback((customerId, field, value) => {
        setSalesData(current => current.map(sale => sale.id === customerId ? { ...sale, [field]: value } : sale));
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        const salesToSave = salesData
            .map(sale => ({ ...sale, items: sale.items.filter(item => item.quantity_sold && parseFloat(item.quantity_sold) > 0) }))
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
                                {products.map(p => (
                                    <th key={p.product_id} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[120px]">
                                        {p.product_name}
                                    </th>
                                ))}
                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[130px]">การชำระเงิน</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[180px]">หมายเหตุ</th>
                                <th className="w-16"></th>
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
