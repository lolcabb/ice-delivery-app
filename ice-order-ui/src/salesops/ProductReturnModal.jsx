// src/salesops/ProductReturnModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../Modal';
import { PlusCircleIcon, TrashIcon, ArchiveBoxIcon } from '../components/Icons';
import { apiService } from '../apiService';

const ProductReturnModal = ({ 
    isOpen, onClose, onSaveSuccess, driver, date, loadedItems = [], 
    existingReturns = [], existingPackagingReturns = [], summary 
}) => {
    // Internal state for the form data
    const [productReturns, setProductReturns] = useState({});
    const [packagingReturns, setPackagingReturns] = useState([]);
    
    // State for data fetched from API (e.g., dropdown options)
    const [lossReasons, setLossReasons] = useState([]);
    const [packagingTypes, setPackagingTypes] = useState([]);

    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Memoized calculations based on props
    const expectedProductReturns = useMemo(() => {
        const expected = {};
        if (Array.isArray(loadedItems)) {
            loadedItems.forEach(item => {
                expected[item.product_id] = (item.loaded || 0) - (item.sold || 0);
            });
        }
        return expected;
    }, [loadedItems]);

    const packagingExpectedOut = useMemo(() => {
        return summary?.total_products_loaded || 0;
    }, [summary]);

    // ** FIX: This useEffect ONLY fetches data when the modal opens **
    useEffect(() => {
        if (isOpen) {
            // Reset UI state on each open
            setError('');
            setIsSubmitting(false);

            // Fetch dropdown data
            apiService.getLossReasons().then(setLossReasons).catch(() => setError("ไม่สามารถโหลดเหตุผลการเสียหายได้"));
            apiService.getPackagingTypes().then(setPackagingTypes).catch(() => setError("ไม่สามารถโหลดประเภทบรรจุภัณฑ์ได้"));
        }
    }, [isOpen]);

    // ** FIX: This useEffect initializes the form state ONLY when the modal opens or the core driver data changes. **
    // It no longer depends on the fetched dropdown data, preventing resets.
    useEffect(() => {
        if (isOpen) {
            // --- Initialize Product Returns State ---
            const initialProductReturns = {};
            if (Array.isArray(loadedItems)) {
                loadedItems.forEach(item => {
                    const existing = existingReturns.filter(r => r.product_id === item.product_id);
                    initialProductReturns[item.product_id] = (existing.length > 0 ? existing : [{
                        _key: Date.now() + Math.random(),
                        product_id: item.product_id,
                        quantity_returned: expectedProductReturns[item.product_id] > 0 ? expectedProductReturns[item.product_id] : '',
                        loss_reason_id: '1', // Default to 'Unsold' or first available reason
                        custom_reason_for_loss: '',
                    }]).map(r => ({
                        ...r,
                        _key: r.return_id || r._key || Date.now() + Math.random(),
                        loss_reason_id: r.loss_reason_id ? r.loss_reason_id.toString() : 'other',
                    }));
                });
            }
            setProductReturns(initialProductReturns);
            
            // --- Initialize Packaging Returns State (FIXED) ---
            const initialPackagingReturns = existingPackagingReturns.length > 0
                ? existingPackagingReturns.map(p => ({
                    ...p,
                    // Use log_id if it exists, otherwise generate a new unique key
                    _key: p.log_id || `temp_id_${Date.now() + Math.random()}`, 
                    packaging_type_id: p.packaging_type_id.toString()
                }))
                // Always generate a unique key for the first new row
                : [{ _key: `new_pkg_${Date.now() + Math.random()}`, packaging_type_id: '', quantity_returned: '' }];
            
            setPackagingReturns(initialPackagingReturns);
        }
    }, [isOpen, loadedItems, existingReturns, existingPackagingReturns]); // Dependency array is now much smaller and more stable

    const handleSaveAll = async () => {
        setError('');
        if (!summary?.summary_id) {
            setError("ไม่สามารถบันทึกการคืนสินค้าได้: ยังไม่ได้เริ่มวันของพนักงานขับรถหรือขึ้นของไม่ถูกต้อง");
            return;
        }

        setIsSubmitting(true);
        try {
            const productItemsToSubmit = Object.values(productReturns).flat().map(entry => {
                const quantity = parseFloat(entry.quantity_returned);
                if (isNaN(quantity) || quantity < 0) return null;
                if (entry.loss_reason_id === 'other' && !entry.custom_reason_for_loss?.trim()) {
                    throw new Error(`ต้องระบุเหตุผลที่กำหนดเองเมื่อเลือก 'อื่นๆ'`);
                }
                return {
                    product_id: entry.product_id,
                    quantity_returned: quantity,
                    loss_reason_id: entry.loss_reason_id !== 'other' ? parseInt(entry.loss_reason_id) : null,
                    custom_reason_for_loss: entry.loss_reason_id === 'other' ? entry.custom_reason_for_loss.trim() : null,
                    notes: entry.notes || null
                };
            }).filter(Boolean);

            const packagingItemsToSubmit = packagingReturns.map(p => {
                const quantity = parseFloat(p.quantity_returned);
                if (p.packaging_type_id && !isNaN(quantity) && quantity >= 0) {
                    return {
                        packaging_type_id: parseInt(p.packaging_type_id),
                        quantity_out: packagingExpectedOut,
                        quantity_returned: quantity,
                        notes: `End-of-day return for driver ${driver.name}.`
                    };
                }
                return null;
            }).filter(Boolean);
            
            await apiService.saveBatchReturns({
                driver_id: driver.driver_id,
                return_date: date,
                driver_daily_summary_id: summary.summary_id,
                product_items: productItemsToSubmit,
                packaging_items: packagingItemsToSubmit,
            });
            
            onSaveSuccess();
            onClose();

        } catch (err) {
            setError(err.message || 'บันทึกคืนสินค้าไม่สำเร็จ กรุณาตรวจสอบข้อมูลที่ป้อน');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // --- State Manipulation Functions (Handlers) ---
    const addReturnEntry = (productId) => setProductReturns(prev => ({ ...prev, [productId]: [...(prev[productId] || []), { _key: Date.now(), product_id: productId, quantity_returned: '', loss_reason_id: lossReasons[0]?.loss_reason_id.toString() || '', custom_reason_for_loss: '' }] }));
    const removeReturnEntry = (productId, keyToRemove) => setProductReturns(prev => ({ ...prev, [productId]: prev[productId].filter(entry => entry._key !== keyToRemove) }));
    const handleSubEntryChange = (productId, key, field, value) => setProductReturns(prev => ({ ...prev, [productId]: prev[productId].map(entry => entry._key === key ? { ...entry, [field]: value } : entry)}));
    
    // FIX: Ensure newly added rows always get a unique key
    const addPackagingReturnRow = () => setPackagingReturns(prev => [
        ...prev, 
        { _key: `new_pkg_${Date.now() + Math.random()}`, packaging_type_id: '', quantity_returned: '' }
    ]);
    const removePackagingReturnRow = (keyToRemove) => setPackagingReturns(prev => prev.filter(p => p._key !== keyToRemove));
    const handlePackagingChange = (index, field, value) => setPackagingReturns(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
    
    const getAvailablePackagingTypes = (currentTypeId) => {
        const selectedIds = packagingReturns.map(p => p.packaging_type_id).filter(id => id && id !== currentTypeId);
        return packagingTypes.filter(pt => !selectedIds.includes(pt.packaging_type_id.toString()));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`บันทึกคืนสินค้าสำหรับ ${driver?.name} ในวันที่ ${date}`}>
            <div className="space-y-6">
                {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}
                <div className="pr-2 space-y-4">
                    <div>
                        <h3 className="text-md font-semibold text-gray-700 mb-2">คืนสินค้า</h3>
                        {loadedItems.map(loadedItem => (
                            <div key={loadedItem.product_id} className="p-3 border rounded-lg bg-gray-50 mb-3">
                                <div className="flex justify-between items-center mb-2">
                                    <div>
                                        <h4 className="font-semibold">{loadedItem.product_name}</h4>
                                        <p className="text-xs text-gray-500">นำขึ้น: {loadedItem.loaded} | ขาย: {loadedItem.sold} | ยอดคืนที่คาดหวัง: {expectedProductReturns[loadedItem.product_id]}</p>
                                    </div>
                                    <button onClick={() => addReturnEntry(loadedItem.product_id)} className="text-sm flex items-center text-blue-600 hover:text-blue-800" title="Add another reason for this product">
                                        <PlusCircleIcon className="w-5 h-5 mr-1" /> เพิ่มเหตุผล
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {(productReturns[loadedItem.product_id] || []).map((entry) => (
                                        <div key={entry._key} className="grid grid-cols-12 gap-2 items-start">
                                            <div className="col-span-3"><input type="number" value={entry.quantity_returned || ''} onChange={(e) => handleSubEntryChange(loadedItem.product_id, entry._key, 'quantity_returned', e.target.value)} className="w-full input-field text-sm" placeholder="จำนวน" min="0" /></div>
                                            <div className="col-span-8">
                                                <select value={entry.loss_reason_id || ''} onChange={(e) => handleSubEntryChange(loadedItem.product_id, entry._key, 'loss_reason_id', e.target.value)} className="w-full input-field text-sm mb-1">
                                                    {lossReasons.map(reason => (<option key={reason.loss_reason_id} value={reason.loss_reason_id.toString()}>{reason.reason_description}</option>))}
                                                    <option value="other">อื่นๆ...</option>
                                                </select>
                                                {entry.loss_reason_id === 'other' && (<input type="text" value={entry.custom_reason_for_loss || ''} onChange={(e) => handleSubEntryChange(loadedItem.product_id, entry._key, 'custom_reason_for_loss', e.target.value)} className="w-full input-field text-sm" placeholder="กรุณาระบุเหตุผล" />)}
                                            </div>
                                            <div className="col-span-1 text-right pt-1"><button onClick={() => removeReturnEntry(loadedItem.product_id, entry._key)} className="p-1 text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2"><h3 className="text-md font-semibold text-gray-700 flex items-center"><ArchiveBoxIcon className="w-5 h-5 mr-2 text-gray-500"/>การคืนบรรจุภัณฑ์</h3><button onClick={addPackagingReturnRow} className="text-sm flex items-center text-blue-600 hover:text-blue-800" title="Add another packaging type"><PlusCircleIcon className="w-5 h-5 mr-1" /> เพิ่มประเภทบรรจุภัณฑ์</button></div>
                        <div className="p-3 border rounded-lg bg-gray-50 space-y-3">
                            <div><label className="block text-xs font-medium text-gray-600">จำนวนบรรจุภัณฑ์ที่นำออกทั้งหมด (คำนวณแล้ว)</label><input type="number" value={packagingExpectedOut} className="w-full input-field text-sm bg-gray-200" readOnly /></div>
                            {packagingReturns.map((p, index) => {
                                const availableTypes = getAvailablePackagingTypes(p.packaging_type_id);
                                const currentTypeInList = packagingTypes.find(pt => pt.packaging_type_id.toString() === p.packaging_type_id);
                                return (
                                <div key={p._key} className="grid grid-cols-12 gap-2 items-end">
                                    <div className="col-span-6">
                                        <label className="block text-xs font-medium text-gray-600">ประเภทบรรจุภัณฑ์</label>
                                        <select value={p.packaging_type_id} onChange={(e) => handlePackagingChange(index, 'packaging_type_id', e.target.value)} className="w-full input-field text-sm">
                                            <option value="">-- เลือก --</option>
                                            {currentTypeInList && <option key={currentTypeInList.packaging_type_id} value={currentTypeInList.packaging_type_id.toString()}>{currentTypeInList.type_name}</option>}
                                            {availableTypes.map(pt => <option key={pt.packaging_type_id} value={pt.packaging_type_id.toString()}>{pt.type_name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-5"><label className="block text-xs font-medium text-gray-600">คืนจริง</label><input type="number" value={p.quantity_returned || ''} onChange={(e) => handlePackagingChange(index, 'quantity_returned', e.target.value)} className="w-full input-field text-sm" placeholder="จำนวน"/></div>
                                    <div className="col-span-1"><button type="button" onClick={() => removePackagingReturnRow(p._key)} className="p-1 text-red-500 hover:text-red-700" title="ลบแถว"><TrashIcon className="w-4 h-4" /></button></div>
                                </div>
                             );
                            })}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">ยกเลิก</button>
                    <button onClick={handleSaveAll} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">
                        {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการคืนทั้งหมด'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ProductReturnModal;
