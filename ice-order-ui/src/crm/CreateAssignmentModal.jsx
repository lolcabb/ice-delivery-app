// src/crm/CreateAssignmentModal.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '../Modal';
import { apiService } from '../apiService';
import { getCurrentLocalDateISO } from '../utils/dateUtils';

// Define static parts of the initial state outside the component
// availableContainers prop will determine the default container_id
const STATIC_CREATE_ASSIGNMENT_FIELDS = {
    customer_id: '',
    customer_name_display: '', // This is for display, actual search text is separate
    expected_return_date: '', 
    notes: '',
};

const CreateAssignmentModal = ({
    isOpen,
    onClose,
    onSave, // This will be handleConfirmCreateAssignment from ContainerAssignmentManager
    availableContainers = []
}) => {
    /*const initialFormData = {
        container_id: '',
        customer_id: '',
        customer_name_display: '',
        assigned_date: getCurrentLocalDateISO(),
        expected_return_date: '', // New field
        notes: '',
    };*/
    const getInitialFormData = useCallback(() => ({
        ...STATIC_CREATE_ASSIGNMENT_FIELDS,
        assigned_date: getCurrentLocalDateISO(),
        container_id: availableContainers.length > 0 ? availableContainers[0].container_id.toString() : '',
    }), [availableContainers]);

    const [formData, setFormData] = useState(getInitialFormData());
    const [customerSearchText, setCustomerSearchText] = useState('');
    const [suggestedCustomers, setSuggestedCustomers] = useState([]);
    const [isCustomerDropdownVisible, setIsCustomerDropdownVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const customerSearchTimeoutRef = useRef(null);
    const customerInputWrapperRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialFormData());
            setCustomerSearchText('');
            setSelectedCustomerDisplay(''); // Clear selected customer display text
            setIsCustomerDropdownVisible(false);
            setSuggestedCustomers([]);
            setError('');
        }
    }, [isOpen, availableContainers, getInitialFormData]);

    // Need to define setSelectedCustomerDisplay if it's used for confirmation message,
    // or rely on formData.customer_name_display directly
    const [selectedCustomerDisplay, setSelectedCustomerDisplay] = useState('');


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCustomerSearchChange = (e) => {
        const newSearchText = e.target.value;
        setCustomerSearchText(newSearchText);

        if (newSearchText !== selectedCustomerDisplay) { // Use selectedCustomerDisplay here
            setFormData(prev => ({ ...prev, customer_id: '', customer_name_display: '' }));
            setSelectedCustomerDisplay(''); // Clear display name if search text changes from selected
        }

        if (customerSearchTimeoutRef.current) clearTimeout(customerSearchTimeoutRef.current);

        if (newSearchText.trim() === '') {
            setSuggestedCustomers([]);
            setIsCustomerDropdownVisible(false);
            setFormData(prev => ({ ...prev, customer_id: '', customer_name_display: '' }));
            setSelectedCustomerDisplay('');
        } else {
            setIsCustomerDropdownVisible(true);
            if (newSearchText.length > 1) {
                customerSearchTimeoutRef.current = setTimeout(async () => {
                    try {
                        const results = await apiService.getCustomers({ search: newSearchText, limit: 7, is_active: 'true' });
                        setSuggestedCustomers(results.data || []);
                    } catch (searchError) {
                        console.error("Failed to search customers:", searchError);
                        setSuggestedCustomers([]);
                    }
                }, 300);
            } else {
                setSuggestedCustomers([]);
            }
        }
    };

    const handleSelectCustomer = (customer) => {
        setFormData(prev => ({
            ...prev,
            customer_id: customer.customer_id.toString(),
            customer_name_display: customer.customer_name
        }));
        setCustomerSearchText(customer.customer_name);
        setSelectedCustomerDisplay(customer.customer_name); // Set display name for confirmation
        setSuggestedCustomers([]);
        setIsCustomerDropdownVisible(false);
    };
    
    useEffect(() => {
        function handleClickOutside(event) {
            if (customerInputWrapperRef.current && !customerInputWrapperRef.current.contains(event.target)) {
                setIsCustomerDropdownVisible(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [customerInputWrapperRef]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.container_id) { setError('กรุณาเลือกถังน้ำแข็ง'); return; }
        if (!formData.customer_id) { setError('กรุณาค้นหาและระบุชื่อลูกค้า'); return; }
        if (!formData.assigned_date) { setError('กรุณากรอกวันที่มอบหมาย'); return; }
        if (formData.expected_return_date && formData.expected_return_date < formData.assigned_date) {
            setError('วันที่คาดว่าจะคืนต้องไม่มาก่อนวันที่มอบหมาย');
            return;
        }

        setIsLoading(true);
        try {
            await onSave({
                container_id: parseInt(formData.container_id),
                customer_id: parseInt(formData.customer_id),
                assigned_date: formData.assigned_date,
                expected_return_date: formData.expected_return_date || null,
                notes: formData.notes.trim() || null,
            });
        } catch (err) {
            console.error("Error in CreateAssignmentModal submit:", err);
            setError(err.data?.error || err.message || "สร้างการมอบหมายถังน้ำแข็งไม่สำเร็จ");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="มอบหมายถังน้ำแข็งให้ลูกค้า">
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Container Selection (existing) */}
                <div>
                    <label htmlFor="container_id_create_assign_modal" className="block text-sm font-medium text-gray-700 mb-1">
                        ถังน้ำแข็งพร้อมใช้งาน <span className="text-red-500">*</span>
                    </label>
                    <select
                        name="container_id"
                        id="container_id_create_assign_modal"
                        value={formData.container_id}
                        onChange={handleChange}
                        className="w-full input-field"
                        required
                        disabled={isLoading || availableContainers.length === 0}
                    >
                        <option value="" disabled>
                            {availableContainers.length === 0 ? "ไม่มีถังน้ำแข็ง 'ในสต็อก'" : "-- เลือกถังน้ำแข็ง --"}
                        </option>
                        {availableContainers.map(c => (
                            <option key={c.container_id} value={c.container_id.toString()}>
                                {c.serial_number} ({c.size_code || c.size_description || 'ไม่มีขนาด'} - {c.container_type || 'ไม่มีประเภท'})
                            </option>
                        ))}
                    </select>
                    {availableContainers.length === 0 && !isLoading && (
                        <p className="text-xs text-red-500 mt-1">ไม่มีถังน้ำแข็ง "ในสต็อก" กรุณาเพิ่มหรือคืนถังน้ำแข็งก่อน</p>
                    )}
                </div>

                {/* Customer Search/Select (existing) */}
                <div className="relative" ref={customerInputWrapperRef}>
                    <label htmlFor="customer_search_create_assign_modal" className="block text-sm font-medium text-gray-700 mb-1">
                        ลูกค้า <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="customer_search_create_assign_modal"
                        value={customerSearchText}
                        onChange={handleCustomerSearchChange}
                        onFocus={() => { if (customerSearchText.trim()) setIsCustomerDropdownVisible(true); }}
                        className="w-full input-field"
                        placeholder="พิมพ์เพื่อค้นหาชื่อลูกค้า"
                        autoComplete="off"
                        disabled={isLoading}
                    />
                    {isCustomerDropdownVisible && suggestedCustomers.length > 0 && (
                        <ul className="absolute z-20 w-full bg-white border border-gray-300 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                            {suggestedCustomers.map(cust => (
                                <li 
                                    key={cust.customer_id} 
                                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                    onMouseDown={(e) => { e.preventDefault(); handleSelectCustomer(cust); }}
                                >
                                    {cust.customer_name} 
                                    {cust.phone && <span className="text-xs text-gray-500 ml-2">({cust.phone})</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                    {isCustomerDropdownVisible && customerSearchText.length > 1 && suggestedCustomers.length === 0 && !isLoading && (
                        <div className="absolute z-10 w-full p-2 bg-white border border-gray-300 rounded-md mt-1 shadow-lg text-sm text-gray-500">
                            ไม่พบลูกค้าที่ตรงกับคำค้นหา "{customerSearchText}".
                        </div>
                    )}
                    {/* Using selectedCustomerDisplay for the confirmation message */}
                    {selectedCustomerDisplay && formData.customer_id && (
                        <p className="text-xs text-green-600 mt-1">เลือกแล้ว: {selectedCustomerDisplay}</p>
                    )}
                </div>
                
                {/* Assigned Date (existing) */}
                <div>
                    <label htmlFor="assigned_date_create_assign_modal" className="block text-sm font-medium text-gray-700 mb-1">
                        วันที่มอบหมาย <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        name="assigned_date"
                        id="assigned_date_create_assign_modal"
                        value={formData.assigned_date}
                        onChange={handleChange}
                        className="w-full input-field"
                        required
                        disabled={isLoading}
                    />
                </div>

                {/* NEW: Expected Return Date */}
                <div>
                    <label htmlFor="expected_return_date_create_assign_modal" className="block text-sm font-medium text-gray-700 mb-1">
                        วันที่คาดว่าจะคืน (ถ้ามี)
                    </label>
                    <input
                        type="date"
                        name="expected_return_date"
                        id="expected_return_date_create_assign_modal"
                        value={formData.expected_return_date}
                        onChange={handleChange}
                        className="w-full input-field"
                        min={formData.assigned_date} // Prevent selection before assigned_date
                        disabled={isLoading}
                    />
                </div>

                {/* Notes (existing) */}
                <div>
                    <label htmlFor="notes_create_assign_modal" className="block text-sm font-medium text-gray-700 mb-1">
                        หมายเหตุ (ถ้ามี)
                    </label>
                    <textarea
                        name="notes"
                        id="notes_create_assign_modal"
                        value={formData.notes}
                        onChange={handleChange}
                        rows="3"
                        className="w-full input-field"
                        placeholder="เช่น, ถังออกงาน, รายละเอียดเพิ่มเติม"
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
                        disabled={isLoading || !formData.container_id || !formData.customer_id}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-60 disabled:bg-green-400 flex items-center justify-center"
                    >
                        {isLoading ? 'กำลังมอบหมาย...' : 'สร้างการมอบหมาย'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default CreateAssignmentModal;