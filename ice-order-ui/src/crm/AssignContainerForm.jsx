// src/crm/AssignContainerForm.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '../Modal';
import { getCustomers } from '../api/customers.js';
import { getCurrentLocalDateISO } from '../utils/dateUtils';

// Define static parts of the initial state outside the component
const STATIC_ASSIGN_CONTAINER_FIELDS = {
    customer_id: '',
    expected_return_date: '', // Default to empty
    notes: '',
};

const AssignContainerForm = ({
    isOpen,
    onClose,
    onSave, // This is handleConfirmAssignment from IceContainerManager
    container,
}) => {
    /*const initialFormData = {
        customer_id: '',
        // customer_name_display: '', // We'll use customerSearchText for input display and a separate selectedCustomerDisplay
        assigned_date: getCurrentLocalDateISO(),
        expected_return_date: '', // New field, initially empty
        notes: '',
    };*/
    const getInitialFormData = useCallback(() => ({
        ...STATIC_ASSIGN_CONTAINER_FIELDS,
        assigned_date: getCurrentLocalDateISO(), // Set current date as default
    }), []);

    const [formData, setFormData] = useState(getInitialFormData());
    const [customerSearchText, setCustomerSearchText] = useState('');
    const [selectedCustomerDisplay, setSelectedCustomerDisplay] = useState(''); // For "Selected: " message
    const [suggestedCustomers, setSuggestedCustomers] = useState([]);
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const searchTimeoutRef = useRef(null);
    const customerInputWrapperRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            // When modal opens, reset the form using the memoized function
            setFormData(getInitialFormData());
            setCustomerSearchText('');
            setSelectedCustomerDisplay('');
            setSuggestedCustomers([]);
            setIsDropdownVisible(false);
            setError('');
        }
    }, [isOpen, getInitialFormData]);

    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const fetchSuggestions = useCallback(async (searchTerm) => {
        if (searchTerm.length < 2) {
            setSuggestedCustomers([]);
            return;
        }
        try {
            const results = await getCustomers({ search: searchTerm, limit: 7, is_active: 'true' });
            setSuggestedCustomers(results.data || []);
        } catch (searchError) {
            console.error("Failed to search customers:", searchError);
            setSuggestedCustomers([]);
            setError('โหลดรายการลูกค้าแนะนำไม่สำเร็จ กรุณาลองใหม่อีกครั้ง.');
        }
    }, []);

    const handleCustomerSearchChange = (e) => {
        const newSearchText = e.target.value;
        setCustomerSearchText(newSearchText);

        if (newSearchText !== selectedCustomerDisplay) {
            setFormData(prev => ({ ...prev, customer_id: '' }));
            setSelectedCustomerDisplay('');
        }

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (newSearchText.trim() === '') {
            setSuggestedCustomers([]);
            setIsDropdownVisible(false);
            setFormData(prev => ({ ...prev, customer_id: '' }));
            setSelectedCustomerDisplay('');
        } else {
            setIsDropdownVisible(true);
            searchTimeoutRef.current = setTimeout(() => {
                fetchSuggestions(newSearchText);
            }, 300);
        }
    };

    const handleSelectCustomer = (customer) => {
        setFormData(prev => ({ ...prev, customer_id: customer.customer_id.toString() }));
        setCustomerSearchText(customer.customer_name);
        setSelectedCustomerDisplay(customer.customer_name);
        setSuggestedCustomers([]);
        setIsDropdownVisible(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (customerInputWrapperRef.current && !customerInputWrapperRef.current.contains(event.target)) {
                setIsDropdownVisible(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.customer_id) { setError('กรุณาเลือกลูกค้าจากรายการ'); return; }
        if (!formData.assigned_date) { setError('กรุณากรอกวันที่มอบหมาย'); return; }
        if (formData.expected_return_date && formData.expected_return_date < formData.assigned_date) {
            setError('วันที่คาดว่าจะคืนต้องไม่มาก่อนวันที่มอบหมาย');
            return;
        }
        if (!container || !container.container_id) { setError('ข้อมูลถังน้ำแข็งไม่ครบถ้วน'); return; }

        setIsLoading(true);
        try {
            const payload = {
                customer_id: parseInt(formData.customer_id),
                assigned_date: formData.assigned_date,
                expected_return_date: formData.expected_return_date || null, // Send null if empty
                notes: formData.notes.trim() || null,
            };
            await onSave(container.container_id, payload); // onSave is handleConfirmAssignment from IceContainerManager
        } catch (err) {
            console.error("Error in AssignContainerForm submit:", err);
            setError(err.data?.error || err.message || 'ไม่สามารถมอบหมายถังน้ำแข็งได้');
        } finally {
            setIsLoading(false);
        }
    };

    if (!container) return null;
    if (!container && isOpen) {
         console.error("AssignContainerForm opened without a valid container prop.");
         return (
            <Modal isOpen={isOpen} onClose={onClose} title="Error">
                <p className="text-red-500">ข้อมูลถังน้ำแข็งไม่ครบถ้วน ไม่สามารถมอบหมายถังน้ำแข็งได้</p>
                 <div className="flex justify-end mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">ปิด</button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`มอบหมายถังน้ำแข็ง: ${container.serial_number} (${container.size_code || container.size_description || ''})`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Customer Search/Select (existing) */}
                <div className="relative" ref={customerInputWrapperRef}>
                    <label htmlFor="customer_name_assign_search" className="block text-sm font-medium text-gray-700 mb-1">
                        ลูกค้า <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="customer_name_search"
                        id="customer_name_assign_search"
                        value={customerSearchText}
                        onChange={handleCustomerSearchChange}
                        onFocus={() => { if (customerSearchText.trim()) setIsDropdownVisible(true); }}
                        className="w-full input-field"
                        placeholder="พิมพ์เพื่อค้นหาชื่อลูกค้า"
                        autoComplete="off"
                        disabled={isLoading}
                    />
                    {isDropdownVisible && suggestedCustomers.length > 0 && (
                        <ul className="absolute z-20 w-full bg-white border border-gray-300 rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                            {suggestedCustomers.map(cust => (
                                <li
                                    key={cust.customer_id}
                                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                    onMouseDown={(e) => { e.preventDefault(); handleSelectCustomer(cust); }}
                                >
                                    {cust.customer_name}
                                    {cust.phone && <span className="text-xs text-gray-500 ml-2">({cust.phone})</span>}
                                    {cust.address && <span className="block text-xs text-gray-400 truncate">{cust.address}</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                    {isDropdownVisible && customerSearchText.length > 1 && suggestedCustomers.length === 0 && !isLoading && (
                        <div className="absolute z-10 w-full p-2 bg-white border border-gray-300 rounded-md mt-1 shadow-lg text-sm text-gray-500">
                            ไม่พบลูกค้าที่ตรงกับคำค้นหา "{customerSearchText}".
                        </div>
                    )}
                    {selectedCustomerDisplay && formData.customer_id && (
                        <p className="text-xs text-green-600 mt-1">
                            เลือกแล้ว: {selectedCustomerDisplay} (ID: {formData.customer_id})
                        </p>
                    )}
                </div>

                {/* Assigned Date (existing) */}
                <div>
                    <label htmlFor="assigned_date_assign_form" className="block text-sm font-medium text-gray-700 mb-1">
                        วันที่มอบหมาย <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        name="assigned_date"
                        id="assigned_date_assign_form"
                        value={formData.assigned_date}
                        onChange={handleInputChange} // Use generic handleInputChange
                        className="w-full input-field"
                        required
                        disabled={isLoading}
                    />
                </div>

                {/* NEW: Expected Return Date */}
                <div>
                    <label htmlFor="expected_return_date_assign_form" className="block text-sm font-medium text-gray-700 mb-1">
                        วันที่คาดว่าจะคืน (ถ้ามี)
                    </label>
                    <input
                        type="date"
                        name="expected_return_date"
                        id="expected_return_date_assign_form"
                        value={formData.expected_return_date}
                        onChange={handleInputChange} // Use generic handleInputChange
                        className="w-full input-field"
                        min={formData.assigned_date} // Prevent selecting date before assigned_date
                        disabled={isLoading}
                    />
                </div>

                {/* Notes (existing) */}
                <div>
                    <label htmlFor="notes_assign_container_form" className="block text-sm font-medium text-gray-700 mb-1">
                        หมายเหตุ (ถ้ามี)
                    </label>
                    <textarea
                        name="notes"
                        id="notes_assign_container_form"
                        value={formData.notes}
                        onChange={handleInputChange} // Use generic handleInputChange
                        rows="3"
                        className="w-full input-field"
                        placeholder="เช่น, คำแนะนำ ฯลฯ"
                        disabled={isLoading}
                    ></textarea>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                        <p>{error}</p>
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200 mt-5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading || !formData.customer_id}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-blue-400 flex items-center justify-center"
                    >
                        {isLoading ? 'กำลังดำเนินการ...' : 'มอบหมายถังน้ำแข็ง'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AssignContainerForm;