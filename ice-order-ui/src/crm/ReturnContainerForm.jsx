// src/crm/ReturnContainerForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../Modal'; // Assuming Modal.jsx is in the parent directory (src/)

import { getCurrentLocalDateISO } from '../utils/dateUtils';

// Define static parts of the initial state outside the component
const STATIC_RETURN_FORM_FIELDS = {
    custom_return_reason: '',
    return_notes: '',
    new_container_status: 'In Stock',
};

const ReturnContainerForm = ({
    isOpen,
    onClose,
    onSaveReturn, // Function from ContainerAssignmentManager
    assignment,   // The assignment object being returned
    returnReasons = [] // Array of { return_reason_id, reason_description }
}) => {
    const getInitialFormState = useCallback(() => ({
        ...STATIC_RETURN_FORM_FIELDS,
        returned_date: getCurrentLocalDateISO(),
        return_reason_id: returnReasons.length > 0 ? returnReasons[0].return_reason_id.toString() : '', // Default to no reason selected
    }), [returnReasons]);

    const [formData, setFormData] = useState(getInitialFormState);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const initialValues = getInitialFormState();
            setFormData({
                ...initialValues,
                // Override with assignment data if present (for potential future edit scenarios, though this form is for new returns)
                return_reason_id: assignment?.return_reason_id?.toString() || initialValues.return_reason_id,
                custom_return_reason: assignment?.custom_return_reason || initialValues.custom_return_reason,
                return_notes: assignment?.return_notes || initialValues.return_notes, // Pre-fill if editing a return
                // returned_date for a *new* return should always default to today
                returned_date: getCurrentLocalDateISO(), 
                new_container_status: 'In Stock', // Always default for a new return action
            });
            setError('');
        }
    }, [isOpen, assignment, returnReasons, getInitialFormState]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.returned_date) {
            setError('จำเป็นต้องระบุวันที่รับคืน');
            return;
        }
        if (!formData.return_reason_id && !formData.custom_return_reason.trim()) {
            setError('กรุณาเลือกเหตุผลการคืนหรือระบุเหตุผลที่กำหนดเอง');
            return;
        }
        if (formData.return_reason_id && formData.custom_return_reason.trim()) {
            setError('กรุณาระบุเหตุผลที่มีให้หรือเหตุผลที่กำหนดเองอย่างใดอย่างหนึ่ง');
            return;
        }
        if (!formData.new_container_status) {
            setError('จำเป็นต้องระบุสถานะถังน้ำแข็งใหม่');
            return;
        }
        if (!assignment || !assignment.assignment_id) {
            setError('ข้อมูลการมอบหมายไม่ครบถ้วน');
            return;
        }


        setIsLoading(true);
        try {
            const payload = {
                returned_date: formData.returned_date,
                return_reason_id: formData.return_reason_id ? parseInt(formData.return_reason_id) : null,
                custom_return_reason: formData.custom_return_reason.trim() || null,
                notes: formData.return_notes.trim() || null, // Maps to 'notes' in the backend for return context
                new_container_status: formData.new_container_status,
            };
            // onSaveReturn is handleConfirmReturn in the manager
            await onSaveReturn(assignment.assignment_id, payload);
            // Parent (ContainerAssignmentManager) will handle closing modal and re-fetching on success
        } catch (err) {
            console.error("Error in ReturnContainerForm submit:", err);
            setError(err.data?.error || err.message || 'ไม่สามารถดำเนินการคืนถังน้ำแข็งได้.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!assignment && isOpen) { // Ensure assignment is available if form is open
        // This case might indicate an issue with how the modal is opened
        // or props are passed. For now, returning null or an error message.
        console.error("ReturnContainerForm opened without a valid assignment prop.");
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Error">
                <p className="text-red-500">ข้อมูลการมอบหมายไม่ครบถ้วน ไม่สามารถดำเนินการคืนถังน้ำแข็งได้</p>
            </Modal>
        );
    }
    if (!isOpen) return null; // Don't render if not open

    const selectedReasonRequiresCustom = () => {
        const selectedReasonObj = returnReasons.find(r => r.return_reason_id.toString() === formData.return_reason_id);
        return selectedReasonObj && selectedReasonObj.reason_description?.toLowerCase().includes('other');
    };


    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Return Container: ${assignment.serial_number || 'N/A'}`}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="returned_date_return_form" className="block text-sm font-medium text-gray-700 mb-1">
                        วันที่คืน <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        name="returned_date"
                        id="returned_date_return_form"
                        value={formData.returned_date}
                        onChange={handleChange}
                        className="w-full input-field" // Assuming 'input-field' is a global or Tailwind-based class
                        required
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label htmlFor="return_reason_id_return_form" className="block text-sm font-medium text-gray-700 mb-1">
                        เหตุผลการคืน {selectedReasonRequiresCustom() ? '' : <span className="text-red-500">*</span>}
                    </label>
                    <select
                        name="return_reason_id"
                        id="return_reason_id_return_form"
                        value={formData.return_reason_id}
                        onChange={handleChange}
                        className="w-full input-field"
                        disabled={isLoading || returnReasons.length === 0}
                    >
                        <option value="">{returnReasons.length === 0 ? "กำลังโหลดเหตุผล..." : "-- เลือกเหตุผล --"}</option>
                        {returnReasons.map(reason => (
                            <option key={reason.return_reason_id} value={reason.return_reason_id.toString()}>
                                {reason.reason_description}
                            </option>
                        ))}
                    </select>
                    {returnReasons.length === 0 && !isLoading && <p className="text-xs text-red-500 mt-1">ไม่มีเหตุผลการคืนให้เลือก</p>}
                </div>

                {/* Conditionally show Custom Return Reason field or if "Other" selected */}
                {(selectedReasonRequiresCustom() || !formData.return_reason_id) && (
                    <div>
                        <label htmlFor="custom_return_reason_return_form" className="block text-sm font-medium text-gray-700 mb-1">
                            เหตุผลการคืน (กรณี "อื่นๆ" หรือไม่ได้เลือกเหตุผลที่มีให้)
                        </label>
                        <input
                            type="text"
                            name="custom_return_reason"
                            id="custom_return_reason_return_form"
                            value={formData.custom_return_reason}
                            onChange={handleChange}
                            className="w-full input-field"
                            placeholder="ระบุเหตุผลอื่น"
                            disabled={isLoading}
                            required={!formData.return_reason_id} // Required if no predefined reason is selected
                        />
                    </div>
                )}

                <div>
                    <label htmlFor="new_container_status_return_form" className="block text-sm font-medium text-gray-700 mb-1">
                        สถานะถังน้ำแข็งใหม่ <span className="text-red-500">*</span>
                    </label>
                    <select
                        name="new_container_status"
                        id="new_container_status_return_form"
                        value={formData.new_container_status}
                        onChange={handleChange}
                        className="w-full input-field"
                        required
                        disabled={isLoading}
                    >
                        <option value="In Stock">In Stock (คืนสต็อกปกติ)</option>
                        <option value="Damaged">Damaged (ชำรุด)</option>
                        <option value="Maintenance">Maintenance (ส่งซ่อม)</option>
                        {/* 'Retired' status is handled by a separate "Retire" action, not typically part of a normal return */}
                    </select>
                </div>
                
                <div>
                    <label htmlFor="return_notes_return_form" className="block text-sm font-medium text-gray-700 mb-1">
                        หมายเหตุการคืน (ถ้ามี)
                    </label>
                    <textarea
                        name="return_notes"
                        id="return_notes_return_form"
                        value={formData.return_notes}
                        onChange={handleChange}
                        rows="3"
                        className="w-full input-field"
                        placeholder="เช่น, ฝาปิดไม่ได้, มีการรั่วซึม, ฯลฯ"
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
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-60 disabled:bg-green-400 flex items-center justify-center"
                    >
                        {isLoading ? 'กำลังดำเนินการ...' : 'ยืนยันการรับคืน'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ReturnContainerForm;