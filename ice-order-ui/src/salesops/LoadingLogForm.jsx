// src/salesops/LoadingLogForm.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Modal from '../Modal'; 
import { getCurrentLocalDateISO } from '../utils/dateUtils'; 
import { PlusCircleIcon, TrashIcon } from '../components/Icons';

// Driver Search Input Component
const DriverSearchInput = ({ drivers, selectedDriver, onSelect, disabled }) => {
    const [searchText, setSearchText] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        //When driver is selected, set the text
        setSearchText(selectedDriver ? selectedDriver.name : '');
    }, [selectedDriver]);

    //Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsDropdownVisible(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearchChange = (e) => {
        const query = e.target.value;
        setSearchText(query);
        if (query) {
            const filtered = drivers.filter(d =>
                d.name.toLowerCase().includes(query.toLowerCase())
            );
            setSuggestions(filtered);
            setIsDropdownVisible(true);
        } else {
            setSuggestions([]);
            setIsDropdownVisible(false);
            onSelect(null); // Clear selection if search is empty
        }
    };

    const handleSelectDriver = (driver) => {
        onSelect(driver);
        setSearchText(driver.name);
        setIsDropdownVisible(false);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <label htmlFor="driver_search_input" className="block text-sm font-medium text-gray-700 mb-1">พนักงานขับรถ</label>
            <input
                id="driver_search_input"
                type="text"
                value={searchText}
                onChange={handleSearchChange}
                onFocus={() => setIsDropdownVisible(true)}
                placeholder="ค้นหาพนักงานขับรถ"
                className="w-full input-field"
                disabled={disabled}
                autoComplete="off"  
            />
            {isDropdownVisible && suggestions.length > 0 && (
                <ul className="absolute z-20 w-full bg-white border border-gray-300 rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map(driver => (
                        <li
                            key={driver.driver_id}
                            className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm"
                            onMouseDown={() => handleSelectDriver(driver)} // Use onMouseDown to prevent input blur
                        >
                            {driver.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const LoadingLogForm = ({ isOpen, onClose, onSave, drivers = [], products = [], deliveryRoutes = [], isLoadingDropdowns, editingBatch = null, allDriverLogs = [] }) => { 
    
    const sortedProducts = useMemo(() => {
        return [...products].sort((a, b) => (a.product_id || 0) - (b.product_id || 0));
    }, [products]);

    const createDefaultLogItem = useCallback((availableProds = sortedProducts, itemData = null) => {
        let defaultProductId = '';
        // If itemData is provided (from editingBatch), use its product_id
        if (itemData && itemData.product_id) {
            defaultProductId = itemData.product_id.toString();
        } 
        // Else, if creating a new item, try to find an available product
        else if (availableProds.length > 0 && availableProds[0]?.product_id != null) {
             defaultProductId = availableProds[0].product_id.toString();
        }
        return {
            product_id: defaultProductId,
            quantity_loaded: itemData ? (itemData.quantity_loaded?.toString() || '') : '',
            // Use a unique key for React list rendering, can be existing ID if editing or new random for new items
            _key: itemData?.loading_log_id || itemData?.product_id || Date.now() + Math.random()
        };
    }, [sortedProducts]);

    // State management for form data
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [formFields, setFormFields] = useState({
        route_id: '',
        load_type: 'initial',
        load_timestamp: new Date().toISOString(),
        notes: '',
        items: [createDefaultLogItem(sortedProducts)] // Start with one default item
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setError('');
            if (editingBatch) {
                const driverForBatch = drivers.find(d => d.driver_id === editingBatch.driver_id);
                setSelectedDriver(driverForBatch || null);
                setFormFields({
                    route_id: editingBatch.route_id?.toString() || '',
                    load_type: editingBatch.load_type || 'initial',
                    load_timestamp: editingBatch.load_timestamp || new Date().toISOString(),
                    notes: editingBatch.notes || '',
                    items: editingBatch.items?.map(item => createDefaultLogItem(sortedProducts, item)) || [createDefaultLogItem(sortedProducts)]
                });
            } else {
                setSelectedDriver(null);
                setFormFields({
                    route_id: deliveryRoutes.length > 0 ? (deliveryRoutes[0]?.route_id.toString() || '') : '',
                    load_type: 'initial',
                    load_timestamp: new Date().toISOString(),
                    notes: '',
                    items: [createDefaultLogItem(sortedProducts)]
                });
            }
            setError('');
        }
    }, [isOpen, editingBatch, drivers, sortedProducts, deliveryRoutes, createDefaultLogItem]);

    useEffect(() => {
        if (editingBatch)
            return;
        
        if (selectedDriver && Array.isArray(allDriverLogs)) {
            const driverHasLogs = allDriverLogs.some(log => log.driver.driver_id === selectedDriver.driver_id && log.loading_logs.length > 0);

            setFormFields(prev => ({
                ...prev,
                load_type: driverHasLogs ? 'reload' : 'initial'
            }));
            
        } else {
            setFormFields(prev => ({
                ...prev,
                load_type: 'initial'
            }));
        }
    }, [selectedDriver, allDriverLogs, editingBatch]);

    const handleCommonFieldChange = (e) => {
        const { name, value } = e.target;
        setFormFields(prev => ({ ...prev, [name]: value }));
    };

    const handleItemChange = (index, field, value) => {
        setFormFields(prev => {
            const newItems = [...prev.items];
            newItems[index][field] = value;
            return { ...prev, items: newItems };
        });
    };

    const handleAddItem = () => {
        const selectedProductIds = formFields.items.map(item => item.product_id).filter(id => id);
        const availableProductsForNewItem = sortedProducts.filter(p => !selectedProductIds.includes(p.product_id.toString()));

        if (availableProductsForNewItem.length === 0 && formFields.items.length > 0) {
            setError("All available products have been added.");
            setTimeout(() => setError(''), 3000);
            return;
        }
        setFormFields(prev => ({
            ...prev,
            items: [...prev.items, createDefaultLogItem(availableProductsForNewItem)]
        }));
        setError('');
    };

    const handleRemoveItem = (indexToRemove) => {
        if (formFields.items.length <= 1) {
            setError("At least one product item is required.");
            return;
        }
        setFormFields(prev => ({
            ...prev,
            items: prev.items.filter((_, index) => index !== indexToRemove)
        }));
        setError('');
    };
    
    const handleTimestampChange = (e) => {
        const localDateTime = e.target.value;
        if (localDateTime) {
            try {
                const dateObj = new Date(localDateTime);
                if (!isNaN(dateObj.getTime())) {
                     setFormFields(prev => ({ ...prev, load_timestamp: dateObj.toISOString() }));
                } else {
                     setFormFields(prev => ({ ...prev, load_timestamp: '' }));
                }
            } catch (parseError) {
                console.error("Error parsing date-time input:", parseError);
                setFormFields(prev => ({ ...prev, load_timestamp: '' }));
            }
        } else {
            setFormFields(prev => ({ ...prev, load_timestamp: '' }));
        }
    };

    const formatDateTimeForInput = (isoString) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return '';
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (e) {
            return '';
        }
    };

    const getAvailableProductsForItem = useCallback((currentItemProductId) => {
        const selectedProductIdsInOtherItems = formFields.items
            .map(item => item.product_id)
            .filter(id => id && id !== currentItemProductId);
        return sortedProducts.filter(p => !selectedProductIdsInOtherItems.includes(p.product_id.toString()));
    }, [formFields.items, sortedProducts]);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!selectedDriver) { setError('กรุณาค้นหาและเลือกพนักงานขับรถ'); return; }
        // ... (rest of the validation is the same, but references formFields.items) ...
        const validItems = formFields.items.map(item => {
            const quantity = parseFloat(item.quantity_loaded);
            if (!item.product_id || isNaN(quantity) || quantity <= 0) {
                return null;
            }
            return { product_id: parseInt(item.product_id), quantity_loaded: quantity };
        }).filter(Boolean);

        if (validItems.length === 0) {
            setError('Please add at least one valid product item with a quantity greater than 0.');
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                driver_id: selectedDriver.driver_id,
                route_id: formFields.route_id ? parseInt(formFields.route_id) : null,
                load_type: formFields.load_type,
                load_timestamp: formFields.load_timestamp, 
                notes: formFields.notes || null,
                items: validItems 
            };
            await onSave(payload);
        } catch (err) {
            console.error("Error in LoadingLogForm submit:", err);
            setError(err.data?.error || err.message || `${editingBatch ? 'อัปเดต' : 'บันทึก'} บันทึกการขึ้นของไม่สำเร็จ`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingBatch ? "แก้ไขบันทึกการขึ้นของ" : "เพิ่มบันทึกการขึ้นของใหม่"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* --- NEW: Using the search component --- */}
                    <DriverSearchInput 
                        drivers={drivers} 
                        selectedDriver={selectedDriver} 
                        onSelect={setSelectedDriver}
                        disabled={isLoading || isLoadingDropdowns}
                    />
                    <div>
                        <label htmlFor="load_timestamp_form" className="block text-sm font-medium text-gray-700 mb-1">วันที่และเวลาขึ้นของ *</label>
                        <input type="datetime-local" name="load_timestamp_input" id="load_timestamp_form" value={formatDateTimeForInput(formFields.load_timestamp)} onChange={handleTimestampChange} className="w-full input-field" required disabled={isLoading} />
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="load_type_form" className="block text-sm font-medium text-gray-700 mb-1">ประเภทการขึ้นของ</label>
                        <select 
                            name="load_type" 
                            id="load_type_form" 
                            value={formFields.load_type} 
                            onChange={handleCommonFieldChange} 
                            className="w-full input-field disabled:bg-gray-100" 
                            required 
                            disabled={true}>
                            <option value="initial">การขึ้นของเริ่มต้น</option>
                            <option value="reload">การเติมของ</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="route_id_form" className="block text-sm font-medium text-gray-700 mb-1">เส้นทาง (ไม่บังคับ)</label>
                        <select 
                            name="route_id" 
                            id="route_id_form" 
                            value={formFields.route_id} 
                            onChange={handleCommonFieldChange} 
                            className="w-full input-field" 
                            disabled={isLoading || isLoadingDropdowns || deliveryRoutes.length === 0}
                        >
                           <option value="">{isLoadingDropdowns ? "กำลังโหลด..." : (deliveryRoutes.length === 0 ? "ไม่มีเส้นทางที่ใช้งานได้" : "-- เลือกเส้นทาง (ไม่บังคับ) --")}</option>
                            {deliveryRoutes.map(route => (
                                <option key={route.route_id} value={route.route_id.toString()}>{route.route_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="pt-2 space-y-3"> 
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-md font-medium text-gray-700">สินค้าที่ขึ้นของแล้ว</h3>
                        <button 
                            type="button" 
                            onClick={handleAddItem} 
                            disabled={isLoading || isLoadingDropdowns || formFields.items.length >= sortedProducts.length}
                            className="px-3 py-1.5 text-xs font-medium text-cyan-700 bg-cyan-100 hover:bg-cyan-200 rounded-md flex items-center disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <PlusCircleIcon /> เพิ่มสินค้า
                        </button>
                    </div>
                    {formFields.items.map((item, index) => {
                        const availableProductsForThisDropdown = getAvailableProductsForItem(item.product_id);
                        const currentItemProduct = sortedProducts.find(p => p.product_id.toString() === item.product_id);

                        return (
                            <div key={item._key || index} className="flex items-end space-x-2 p-2 border border-gray-200 rounded-md bg-gray-50/50">
                                <div className="flex-grow">
                                    <label htmlFor={`product_id_item_${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">สินค้า *</label>
                                    <select 
                                        name="product_id" 
                                        id={`product_id_item_${index}`}
                                        value={item.product_id} 
                                        onChange={(e) => handleItemChange(index, 'product_id', e.target.value)} 
                                        className="w-full input-field text-sm py-1" 
                                        required 
                                        disabled={isLoading || isLoadingDropdowns || sortedProducts.length === 0}
                                    >
                                        <option value="" disabled>{isLoadingDropdowns ? "กำลังโหลด..." : (sortedProducts.length === 0 ? "ไม่มีสินค้า" : "-- เลือกสินค้า --")}</option>
                                        {currentItemProduct && (
                                            <option key={currentItemProduct.product_id} value={currentItemProduct.product_id.toString()}>
                                                {currentItemProduct.product_name} ({currentItemProduct.unit_of_measure || 'N/A'})
                                            </option>
                                        )}
                                        {availableProductsForThisDropdown
                                            .filter(p => p.product_id.toString() !== item.product_id) 
                                            .map(p => (
                                            <option key={p.product_id} value={p.product_id.toString()}>{p.product_name} ({p.unit_of_measure || 'N/A'})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-28">
                                    <label htmlFor={`quantity_loaded_item_${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">จำนวน *</label>
                                    <input 
                                        type="number" 
                                        name="quantity_loaded" 
                                        id={`quantity_loaded_item_${index}`}
                                        value={item.quantity_loaded} 
                                        onChange={(e) => handleItemChange(index, 'quantity_loaded', e.target.value)} 
                                        className="w-full input-field text-sm py-1" 
                                        placeholder="จำนวน" 
                                        step="any" 
                                        required 
                                        disabled={isLoading} 
                                    />
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => handleRemoveItem(index)} 
                                    disabled={isLoading || formFields.items.length <= 1} 
                                    className="p-1.5 text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                    title="ลบสินค้า"
                                >
                                    <TrashIcon /> 
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div>
                    <label htmlFor="notes_form" className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ (ไม่บังคับ)</label>
                    <textarea name="notes" id="notes_form" value={formFields.notes} onChange={handleCommonFieldChange} rows="2" className="w-full input-field" placeholder="หมายเหตุเกี่ยวกับการขึ้นของทั้งหมด" disabled={isLoading}></textarea>
                </div>

                {error && (
                    <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm">
                        <p>{error}</p>
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60">
                        ยกเลิก
                    </button>
                    <button type="submit" disabled={isLoading || isLoadingDropdowns} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 border border-transparent rounded-md shadow-sm hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-60 disabled:bg-cyan-400 flex items-center justify-center">
                        {isLoading ? 'กำลังบันทึก...' : (editingBatch ? 'อัปเดตการขึ้นของ' : 'บันทึกการขึ้นของ')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default LoadingLogForm;
