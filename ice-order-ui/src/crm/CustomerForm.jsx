// Suggested path: src/crm/CustomerForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../Modal'; // Assuming Modal.jsx is in parent directory (e.g., src/Modal.jsx)

// Define static parts of the initial state outside the component
const STATIC_CUSTOMER_FORM_FIELDS = {
    customer_name: '',
    phone: '',
    address: '',
    contact_person: '',
    customer_type: '',
    // route_id will be set dynamically based on props or if editing
    notes: '',
    is_active: true, // Default new customers to active
};

const CustomerForm = ({
    isOpen,
    onClose,
    onSave, // Function from CustomerManager
    customer, // Current customer being edited (null if adding new)
    deliveryRoutes = [] // Array of active delivery_routes { route_id, route_name }
}) => {
    /*const initialFormState = {
        customer_name: '',
        phone: '',
        address: '',
        contact_person: '',
        customer_type: '',
        route_id: '',
        notes: '',
        is_active: true, // Default new customers to active
    };*/

    const getinitialFormState = useCallback(() => ({
        ...STATIC_CUSTOMER_FORM_FIELDS,
        route_id: deliveryRoutes.length > 0 ? deliveryRoutes[0].route_id.toString() : '',
    }), [deliveryRoutes]);

    const [formData, setFormData] = useState(getinitialFormState());
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isEditing = Boolean(customer && customer.customer_id);

    useEffect(() => {
        if (isOpen) {
            if (isEditing && customer) {
                setFormData({
                    customer_name: customer.customer_name || '',
                    phone: customer.phone || '',
                    address: customer.address || '',
                    contact_person: customer.contact_person || '',
                    customer_type: customer.customer_type || '',
                    route_id: customer.route_id?.toString() || (deliveryRoutes.length > 0 ? deliveryRoutes[0].route_id.toString() : ''),
                    notes: customer.notes || '',
                    is_active: customer.is_active === undefined ? true : customer.is_active,
                });
            } else {
                // Reset for new customer using the memoized function
                setFormData(getinitialFormState());
            }
            setError('');
        }
    }, [customer, isOpen, isEditing, deliveryRoutes, getinitialFormState]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.customer_name.trim()) { setError('จำเป็นต้องระบุชื่อลูกค้า'); return; }
        // Add more specific validations as needed (e.g., phone format)

        setIsLoading(true);
        try {
            const payload = {
                ...formData,
                customer_name: formData.customer_name.trim(),
                phone: formData.phone.trim() || null,
                address: formData.address.trim() || null,
                contact_person: formData.contact_person.trim() || null,
                customer_type: formData.customer_type.trim() || null,
                route_id: formData.route_id ? parseInt(formData.route_id) : null,
                notes: formData.notes.trim() || null,
                is_active: formData.is_active,
            };
            
            await onSave(payload); // Calls handleSaveCustomer in CustomerManager
        } catch (err) {
            console.error("Error in CustomerForm submit:", err);
            setError(err.message || 'บันทึกข้อมูลลูกค้าไม่สำเร็จ');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `แก้ไขลูกค้า: ${formData.customer_name}` : 'เพิ่มลูกค้าใหม่'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-1">
                        ชื่อลูกค้า <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="customer_name"
                        id="customer_name"
                        value={formData.customer_name}
                        onChange={handleChange}
                        className="w-full input-field"
                        placeholder="เช่น, บริษัท น้ำแข็งใส จำกัด, ร้านอาหารคุณป้า"
                        required
                        disabled={isLoading}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">เบอร์ติดต่อ</label>
                        <input type="tel" name="phone" id="phone" value={formData.phone} onChange={handleChange} className="w-full input-field" placeholder="เช่น, 0812345678" disabled={isLoading}/>
                    </div>
                    <div>
                        <label htmlFor="contact_person" className="block text-sm font-medium text-gray-700 mb-1">ผู้ติดต่อ</label>
                        <input type="text" name="contact_person" id="contact_person" value={formData.contact_person} onChange={handleChange} className="w-full input-field" placeholder="เช่น, คุณสมชาย" disabled={isLoading}/>
                    </div>
                </div>

                <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่</label>
                    <textarea name="address" id="address" value={formData.address} onChange={handleChange} rows="3" className="w-full input-field" placeholder="รายละเอียดที่อยู่เต็ม" disabled={isLoading}></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="customer_type" className="block text-sm font-medium text-gray-700 mb-1">ประเภทลูกค้า</label>
                        <input type="text" name="customer_type" id="customer_type" value={formData.customer_type} onChange={handleChange} className="w-full input-field" placeholder="เช่น, ร้านอาหาร, โรงแรม, โรงไก่" disabled={isLoading}/>
                    </div>
                    <div>
                        <label htmlFor="route_id" className="block text-sm font-medium text-gray-700 mb-1">สายที่จัดส่ง</label>
                        <select
                            name="route_id"
                            id="route_id"
                            value={formData.route_id}
                            onChange={handleChange}
                            className="w-full input-field disabled:bg-gray-100"
                            disabled={isLoading || deliveryRoutes.length === 0}
                        >
                            <option value="">{deliveryRoutes.length === 0 ? "กำลังโหลดสาย..." : "เลือกสาย (ไม่บังคับ)"}</option>
                            {deliveryRoutes.map(route => (
                                <option key={route.route_id} value={route.route_id.toString()}>
                                    {route.route_name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label htmlFor="notes_customer" className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                    <textarea name="notes" id="notes_customer" value={formData.notes} onChange={handleChange} rows="2" className="w-full input-field" placeholder="หมายเหตุเฉพาะเกี่ยวกับลูกค้าท่านนี้" disabled={isLoading}></textarea>
                </div>

                <div className="flex items-center">
                    <input
                        id="is_active_customer"
                        name="is_active"
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={handleChange}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                        disabled={isLoading}
                    />
                    <label htmlFor="is_active_customer" className="ml-2 block text-sm text-gray-900">
                        ลูกค้าที่ใช้บริการอยู่
                    </label>
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
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-indigo-400 flex items-center justify-center"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                กำลังดำเนินการ...
                            </>
                        ) : (isEditing ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มลูกค้า')}
                    </button>
                </div>
            </form>
            {/* Assuming .input-field styles are globally available or defined in parent */}
        </Modal>
    );
};

export default CustomerForm;
