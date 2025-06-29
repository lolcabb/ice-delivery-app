// src/salesops/SalesEntryTable.jsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { PlusCircleIcon, TrashIcon, XCircleIcon } from '../components/Icons';
import { apiService } from '../apiService';

const defaultProductPlaceholder = { product_id: '', product_name: 'N/A', default_unit_price: '0' };

const SalesEntryTable = ({ onSubmitSale, products = [], existingSales = [], disabled = false, saleToEdit, onCustomerSelect, onClearForm }) => {

    const sortedProducts = useMemo(() => [...products].sort((a, b) => (a.product_id || 0) - (b.product_id || 0)), [products]);

    const createInitialLine = useCallback(() => {
        const defaultProduct = sortedProducts[0] || defaultProductPlaceholder;
        return { _tempId: Date.now() + Math.random(), product_id: defaultProduct.product_id.toString(), quantity_sold: '', unit_price: defaultProduct.default_unit_price || '0' };
    }, [sortedProducts]);

    const createInitialState = useCallback((sale = null) => {
        if (sale) {
            return {
                customer_id: sale.customer_id || '',
                customer_name_override: sale.customer_name_override || '',
                payment_type: sale.payment_type || 'Cash',
                notes: sale.notes || '',
                items: sale.sale_items && sale.sale_items.length > 0 
                    ? sale.sale_items.map(item => ({
                        _tempId: item.item_id || Date.now() + Math.random(),
                        product_id: item.product_id.toString(),
                        quantity_sold: item.quantity_sold.toString(),
                        unit_price: item.unit_price.toString()
                      }))
                    : [createInitialLine()]
            };
        }
        return { customer_id: '', customer_name_override: '', payment_type: 'Cash', notes: '', items: [createInitialLine()] };
    }, [createInitialLine]);
    
    const [saleData, setSaleData] = useState(createInitialState(saleToEdit));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [customerSearchText, setCustomerSearchText] = useState('');
    const [customerSuggestions, setCustomerSuggestions] = useState([]);
    const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
    const searchTimeoutRef = useRef(null);
    const customerSearchWrapperRef = useRef(null);
    const isEditing = useMemo(() => saleToEdit && saleToEdit.sale_id, [saleToEdit]);

    const getAvailableProductsForItem = useCallback((currentItemProductId) => {
        const selectedProductIdsInOtherItems = saleData.items
            .map(item => item.product_id)
            .filter(id => id && id !== currentItemProductId);
        return sortedProducts.filter(p => !selectedProductIdsInOtherItems.includes(p.product_id.toString()));
    }, [saleData.items, sortedProducts]);

    // This effect SYNCHRONIZES the form's state with the prop from the parent
    useEffect(() => {
        setSaleData(createInitialState(saleToEdit));
        if (saleToEdit && saleToEdit.customer_id) {
            setCustomerSearchText(saleToEdit.actual_customer_name || '');
            // FIX: Explicitly hide suggestions when loading a record to edit
            setIsSuggestionsVisible(false); 
        } else if (!saleToEdit) {
            setCustomerSearchText('');
        }
    }, [saleToEdit, createInitialState]);


    // This effect handles the DEBOUNCED API call for searching
    useEffect(() => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        
        // Only run the search if the search text is not empty
        if (!customerSearchText.trim()) {
            setCustomerSuggestions([]);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            // And if the suggestions are supposed to be visible
            if (isSuggestionsVisible) {
                try {
                    const response = await apiService.getCustomers({ search: customerSearchText, is_active: true, limit: 10 });
                    setCustomerSuggestions(response.data || []);
                } catch (searchError) { console.error("Failed to fetch customer suggestions:", searchError); }
            }
        }, 300);

        return () => clearTimeout(searchTimeoutRef.current);
    }, [customerSearchText, isSuggestionsVisible]); // Now depends on visibility state

    // This effect closes the dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (customerSearchWrapperRef.current && !customerSearchWrapperRef.current.contains(event.target)) setIsSuggestionsVisible(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // This handler is called when the user TYPES in the search box
    const handleCustomerSearchChange = (e) => {
        const newText = e.target.value;
        setCustomerSearchText(newText);
        // Show suggestions as soon as the user starts typing
        if (newText.trim()) {
            setIsSuggestionsVisible(true);
        }
        if (saleData.customer_id) {
            setSaleData(prev => ({ ...prev, customer_id: '' }));
        }
    };

    // This handler is called when a user CLICKS a suggestion
    const handleSelectCustomer = (customer) => {
        setCustomerSearchText(customer.customer_name);
        setIsSuggestionsVisible(false); // Hide the dropdown immediately
        onCustomerSelect(customer); // Let the parent manager handle the logic
    };

    const handleClearForm = () => {
        onClearForm();
        setCustomerSearchText('');
    };

    const handleHeaderChange = (e) => {
        const { name, value } = e.target;
        setSaleData(prev => ({ ...prev, [name]: value }));
    };

    const handleItemChange = (index, field, value) => {
        setSaleData(prevData => {
            const newItems = [...prevData.items];
            newItems[index] = { ...newItems[index], [field]: value };
            if (field === 'product_id' && value) {
                const selectedProduct = sortedProducts.find(p => p.product_id.toString() === value);
                if (selectedProduct) {
                    newItems[index].unit_price = selectedProduct.default_unit_price || '0';
                }
            }
            return { ...prevData, items: newItems };
        });
    };

    const addItem = () => setSaleData(prev => ({ ...prev, items: [...prev.items, createInitialLine()] }));

    const removeItem = (indexToRemove) => {
        if (saleData.items.length <= 1) return;
        setSaleData(prev => ({ ...prev, items: prev.items.filter((_, index) => index !== indexToRemove) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!saleData.customer_id && !saleData.customer_name_override.trim()) {
            setError("กรุณาเลือกลูกค้าที่มีอยู่ หรือระบุชื่อสำหรับลูกค้าหน้าร้าน/ลูกค้าไม่ประจำ");
            return;
        }
        if (saleData.items.some(item => !item.product_id || !item.quantity_sold || parseFloat(item.quantity_sold) <= 0 || item.unit_price === '' || parseFloat(item.unit_price) < 0)) {
            setError("กรุณาให้แน่ใจว่าทุกรายการขายมีการเลือกสินค้า, จำนวนมากกว่า 0, และราคาที่ไม่เป็นลบ");
            return;
        }
        setIsSubmitting(true);
        try {
            await onSubmitSale(saleData);
        } catch (err) {
            setError(err.message || "เกิดข้อผิดพลาดที่ไม่คาดคิด");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const totalSaleAmount = useMemo(() => 
        saleData.items.reduce((total, item) => total + (parseFloat(item.quantity_sold) || 0) * (parseFloat(item.unit_price) || 0), 0),
    [saleData.items]);
    
    // The JSX for the form can now remain the same as my previous response.
    // The logic changes above are what fix the behavior.
    return (
        <form onSubmit={handleSubmit} className={`p-4 border rounded-lg ${disabled ? 'bg-gray-100 opacity-70' : 'bg-white'}`}>
            <fieldset disabled={disabled}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-800">
                        {isEditing ? `กำลังแก้ไขการขาย #${saleToEdit.sale_id}` : 'แบบฟอร์มการขายใหม่'}
                    </h3>
                    {isEditing && (
                        <button type="button" onClick={handleClearForm} className="text-xs flex items-center px-2 py-1.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md shadow-sm">
                            <XCircleIcon className="w-4 h-4 mr-1"/>
                            ยกเลิกการแก้ไข
                        </button>
                    )}
                </div>
                {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm mb-4">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div className="relative" ref={customerSearchWrapperRef}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ค้นหาลูกค้า</label>
                        <input
                            type="text"
                            value={customerSearchText}
                            onChange={handleCustomerSearchChange}
                            placeholder="พิมพ์เพื่อค้นหาลูกค้า..."
                            className="w-full input-field text-sm"
                            autoComplete="off"
                            disabled={!!saleData.customer_name_override.trim()}
                        />
                        {isSuggestionsVisible && customerSuggestions.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 shadow-lg max-h-60 overflow-y-auto">
                                {customerSuggestions.map(cust => (
                                    <li key={cust.customer_id} className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm" onMouseDown={() => handleSelectCustomer(cust)}>
                                        {cust.customer_name}
                                        {cust.phone && <span className="text-xs text-gray-500 ml-2">({cust.phone})</span>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>     
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">หรือชื่อลูกค้าหน้าร้าน/ลูกค้าไม่ประจำ</label>
                        <input type="text" name="customer_name_override" value={saleData.customer_name_override} onChange={handleHeaderChange} placeholder="เช่น ร้านข้าวข้างทาง" className="w-full input-field text-sm" disabled={!!saleData.customer_id} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทการชำระเงิน</label>
                        <select name="payment_type" value={saleData.payment_type} onChange={handleHeaderChange} className="w-full input-field text-sm">
                            <option value="Cash">เงินสด</option>
                            <option value="Credit">เครดิต</option>
                            <option value="Debit">เดบิต</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-3 mb-4">
                    <h4 className="text-md font-medium text-gray-700 border-t pt-4">รายการขาย</h4>
                    {saleData.items.map((item, index) => {
                        const availableProducts = getAvailableProductsForItem(item.product_id);
                        const currentItemProductInfo = sortedProducts.find(p => p.product_id.toString() === item.product_id);
                        return (
                            <div key={item._tempId} className="grid grid-cols-12 gap-x-2 items-end p-2 border rounded bg-gray-50/80">
                                <div className="col-span-5">
                                    <label className="block text-xs font-medium text-gray-600">สินค้า</label>
                                    <select name="product_id" value={item.product_id} onChange={e => handleItemChange(index, 'product_id', e.target.value)} className="w-full input-field text-sm py-1" required>
                                        <option value="" disabled>-- เลือกสินค้า --</option>
                                        {currentItemProductInfo && (
                                            <option key={currentItemProductInfo.product_id} value={currentItemProductInfo.product_id.toString()}>
                                                {currentItemProductInfo.product_name}
                                            </option>
                                        )}
                                        {availableProducts.filter(p => p.product_id.toString() !== item.product_id).map(p => (
                                            <option key={p.product_id} value={p.product_id.toString()}>{p.product_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2"><label className="block text-xs font-medium text-gray-600">จำนวน</label><input type="number" name="quantity_sold" value={item.quantity_sold} onChange={e => handleItemChange(index, 'quantity_sold', e.target.value)} className="w-full input-field text-sm py-1 text-right" placeholder="จำนวน" step="any" /></div>
                                <div className="col-span-2"><label className="block text-xs font-medium text-gray-600">ราคา/หน่วย</label><input type="number" name="unit_price" value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} className="w-full input-field text-sm py-1 text-right" placeholder="ราคา" step="any" /></div>
                                <div className="col-span-2 flex flex-col items-end justify-end pb-1"><label className="block text-xs font-medium text-gray-600 self-start">ยอดรวมย่อย</label><span className="text-sm font-semibold text-gray-800">{((parseFloat(item.quantity_sold) || 0) * (parseFloat(item.unit_price) || 0)).toFixed(2)}</span></div>
                                <div className="col-span-1 flex items-center justify-end"><button type="button" onClick={() => removeItem(index)} disabled={saleData.items.length <= 1} className="p-1.5 text-red-500 hover:text-red-700 disabled:text-gray-400 rounded-md"><TrashIcon className="w-5 h-5"/></button></div>
                            </div>
                        );
                    })}
                    <button type="button" onClick={addItem} className="px-3 py-1.5 text-sm font-medium text-cyan-700 bg-cyan-100 hover:bg-cyan-200 rounded-md flex items-center"><PlusCircleIcon className="w-5 h-5 mr-1"/> เพิ่มรายการ</button>
                </div>

                <div className="border-t pt-4">
                     <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุการขาย (ไม่บังคับ)</label>
                    <textarea name="notes" value={saleData.notes} onChange={handleHeaderChange} rows="2" className="w-full input-field text-sm" placeholder="หมายเหตุเฉพาะสำหรับการขายนี้..."/>
                </div>
                <div className="flex justify-between items-center mt-4">
                    <span className="text-lg font-bold text-gray-800">รวม: {totalSaleAmount.toFixed(2)} ฿</span>
                    <button type="submit" disabled={isSubmitting} className={`px-6 py-2 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 ${isEditing ? 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'}`}>
                        {isSubmitting ? 'กำลังบันทึก...' : (isEditing ? 'อัปเดตการขาย' : 'บันทึกการขาย')}
                    </button>
                </div>
            </fieldset>
        </form>
    );
};

export default SalesEntryTable;