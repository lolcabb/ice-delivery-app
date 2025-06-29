// ice-delivery-app/ice-order-ui/src/crm/EditPaymentForm.jsx
import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { formatDateForInput } from '../utils/dateUtils';

const EditPaymentForm = ({ isOpen, onClose, onSave, payment }) => {
    const [formData, setFormData] = useState({ payment_date: '', payment_method: '', notes: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (payment) {
            setFormData({
                payment_date: formatDateForInput(payment.payment_date),
                payment_method: payment.payment_method || 'Bank Transfer',
                notes: payment.notes || ''
            });
        }
    }, [payment]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await onSave(payment.payment_id, formData);
            onClose();
        } catch (err) {
            setError(err.message || "Failed to save changes.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit Payment #${payment.payment_id}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}
                <div>
                    <label className="block text-sm font-medium">Payment Date *</label>
                    <input type="date" name="payment_date" value={formData.payment_date} onChange={handleChange} className="w-full input-field" required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Payment Method *</label>
                    <select name="payment_method" value={formData.payment_method} onChange={handleChange} className="w-full input-field" required>
                        <option>Bank Transfer</option>
                        <option>Cash</option>
                        <option>Other</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">Notes</label>
                    <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full input-field" rows="3"></textarea>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button type="button" onClick={onClose} disabled={isLoading} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={isLoading} className="btn-primary">
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default EditPaymentForm;