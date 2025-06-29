// src/salesops/ProductReturnForm.jsx
import React, { useState, useMemo } from 'react';

const ProductReturnForm = ({ products = [], driverId, date, onSubmit, disabled = false }) => {
    const initialFormState = {
        product_id: products[0]?.product_id.toString() || '',
        quantity_returned: '',
        custom_reason_for_loss: '',
        notes: ''
    };
    const [formData, setFormData] = useState(initialFormState);
    const [error, setError] = useState('');

    const sortedProducts = useMemo(() => [...products].sort((a, b) => (a.product_id || 0) - (b.product_id || 0)), [products]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!formData.product_id || !formData.quantity_returned || !formData.custom_reason_for_loss.trim()) {
            setError('สินค้า, จำนวนที่คืน, และ เหตุผล เป็นข้อมูลที่จำเป็น');
            return;
        }
        if (parseFloat(formData.quantity_returned) <= 0) {
            setError('จำนวนต้องเป็นตัวเลขที่เป็นบวก');
            return;
        }

        const payload = {
            driver_id: driverId,
            return_date: date,
            product_id: parseInt(formData.product_id),
            quantity_returned: parseFloat(formData.quantity_returned),
            custom_reason_for_loss: formData.custom_reason_for_loss.trim(),
            notes: formData.notes.trim() || null
        };

        try {
            await onSubmit(payload);
            setFormData(initialFormState); // Reset form on success
        } catch (err) {
            setError(err.message || "บันทึกการคืนสินค้าไม่สำเร็จ");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-white shadow-sm">
            <fieldset disabled={disabled}>
                <h3 className="text-md font-semibold text-gray-700 mb-3">บันทึกคืนสินค้า / สินค้าเสียหาย</h3>
                {error && <div className="p-2 bg-red-100 text-red-700 rounded-md text-sm mb-3">{error}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="product_id" className="block text-sm font-medium text-gray-600 mb-1">สินค้า</label>
                        <select name="product_id" value={formData.product_id} onChange={handleChange} className="w-full input-field text-sm">
                            {sortedProducts.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="quantity_returned" className="block text-sm font-medium text-gray-600 mb-1">จำนวนที่คืน/สูญหาย</label>
                        <input type="number" name="quantity_returned" value={formData.quantity_returned} onChange={handleChange} className="w-full input-field text-sm" placeholder="เช่น 5" step="any" min="0.01" />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="custom_reason_for_loss" className="block text-sm font-medium text-gray-600 mb-1">เหตุผลในการคืน/สูญหาย</label>
                        <input type="text" name="custom_reason_for_loss" value={formData.custom_reason_for_loss} onChange={handleChange} className="w-full input-field text-sm" placeholder="เช่น ละลาย" />
                    </div>
                     <div className="md:col-span-2">
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-600 mb-1">หมายเหตุ (ไม่บังคับ)</label>
                        <textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" className="w-full input-field text-sm" placeholder="รายละเอียดเพิ่มเติม..." />
                    </div>
                </div>
                <div className="mt-4 text-right">
                    <button type="submit" disabled={disabled} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60">
                        บันทึกการคืน
                    </button>
                </div>
            </fieldset>
        </form>
    );
};

export default ProductReturnForm;