// src/crm/EditAssignmentForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../Modal'; // Assuming Modal.jsx is in the parent directory (src/)

import { formatDateForInput } from '../utils/dateUtils';

// Static initial fields (though this form primarily populates from a prop)
const STATIC_EDIT_ASSIGNMENT_FIELDS = {
    assigned_date: '', // Will be overridden by prop or formatted prop value
    expected_return_date: '', // Will be overridden
    notes: '',
};

const EditAssignmentForm = ({
    isOpen,
    onClose,
    onSaveEdit, // Function from ContainerAssignmentManager (e.g., handleConfirmEditAssignment)
    assignmentToEdit // The full assignment object being edited
}) => {

    const getInitialFormState = useCallback(() => {
        if (assignmentToEdit) {
            return {
                assigned_date: formatDateForInput(assignmentToEdit.assigned_date),
                expected_return_date: formatDateForInput(assignmentToEdit.expected_return_date),
                notes: assignmentToEdit.notes || '',
            };
        }
        return {
            ...STATIC_EDIT_ASSIGNMENT_FIELDS,
        };
    }, [assignmentToEdit]);

    const [formData, setFormData] = useState(getInitialFormState());
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && assignmentToEdit) {
            setFormData({
                assigned_date: formatDateForInput(assignmentToEdit.assigned_date),
                expected_return_date: formatDateForInput(assignmentToEdit.expected_return_date),
                notes: assignmentToEdit.notes || '',
            });
        } else {
            setFormData({
                ...STATIC_EDIT_ASSIGNMENT_FIELDS,
            });
            console.warn("EditAssignmentForm opened without 'assignmentToEdit' context, resetting form state.");
        }
        setError('');
    }, [isOpen, assignmentToEdit, getInitialFormState]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.assigned_date) {
            setError('จำเป็นต้องระบุวันที่มอบหมาย');
            return;
        }
        if (formData.expected_return_date && formData.expected_return_date < formData.assigned_date) {
            setError('วันที่คาดว่าจะคืนต้องไม่มาก่อนวันที่มอบหมาย');
            return;
        }
        if (!assignmentToEdit || !assignmentToEdit.assignment_id) {
            setError('ข้อมูลการมอบหมายไม่ครบถ้วน'); // Should not happen if form is open correctly
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                assigned_date: formData.assigned_date,
                expected_return_date: formData.expected_return_date || null, // Send null if empty
                notes: formData.notes.trim() || null, // Send null if empty
            };
            // onSaveEdit is handleConfirmEditAssignment in the manager
            await onSaveEdit(assignmentToEdit.assignment_id, payload);
            // Parent (ContainerAssignmentManager) will handle closing modal and re-fetching on success
        } catch (err) {
            console.error("Error in EditAssignmentForm submit:", err);
            setError(err.data?.error || err.message || 'อัปเดตรายละเอียดการมอบหมายไม่สำเร็จ');
        } finally {
            setIsLoading(false);
        }
    };

    if (!assignmentToEdit) return null; // Don't render if no assignment context when open
    if (!assignmentToEdit && isOpen) { 
        // Handle case where form is open but no data to edit (should not typically happen)
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Error">
                <p className="text-red-500">ไม่มีข้อมูลการมอบหมายสำหรับการแก้ไข</p>
                <div className="flex justify-end mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">ปิด</button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`แก้ไขการมอบหมาย (ID: ${assignmentToEdit.assignment_id})`}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Display-only information */}
                <div className="p-3 bg-gray-50 rounded-md border border-gray-200 space-y-1 text-sm">
                    <div>
                        <span className="font-semibold text-gray-600">ถังน้ำแข็ง:</span>
                        <span className="ml-2 text-gray-800">{assignmentToEdit.serial_number} ({assignmentToEdit.container_size_code || 'ไม่พบขนาด'})</span>
                    </div>
                    <div>
                        <span className="font-semibold text-gray-600">ลูกค้า:</span>
                        <span className="ml-2 text-gray-800">{assignmentToEdit.customer_name}</span>
                    </div>
                </div>

                <div>
                    <label htmlFor="assigned_date_edit_assign_form" className="block text-sm font-medium text-gray-700 mb-1">
                        วันที่มอบหมาย <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        name="assigned_date"
                        id="assigned_date_edit_assign_form"
                        value={formData.assigned_date}
                        onChange={handleChange}
                        className="w-full input-field"
                        required
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label htmlFor="expected_return_date_edit_assign_form" className="block text-sm font-medium text-gray-700 mb-1">
                        วันที่คาดว่าจะส่งคืน (ถ้ามี)
                    </label>
                    <input
                        type="date"
                        name="expected_return_date"
                        id="expected_return_date_edit_assign_form"
                        value={formData.expected_return_date}
                        onChange={handleChange}
                        className="w-full input-field"
                        min={formData.assigned_date} // Prevent selection before assigned_date
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label htmlFor="notes_edit_assign_form" className="block text-sm font-medium text-gray-700 mb-1">
                        หมายเหตุ (ถ้ามี)
                    </label>
                    <textarea
                        name="notes"
                        id="notes_edit_assign_form"
                        value={formData.notes}
                        onChange={handleChange}
                        rows="4"
                        className="w-full input-field"
                        placeholder="อัปเดตหมายเหตุสำหรับการมอบหมายนี้"
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
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-indigo-400 flex items-center justify-center"
                    >
                        {isLoading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default EditAssignmentForm;