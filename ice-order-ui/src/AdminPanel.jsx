// 📁 File: AdminPanel.js
// Refactored for Tailwind v4 principles, clarity, and UI improvements

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { request } from './api/base.js';
import { handleComponentAuthError } from './api/helpers.js';

import { getCurrentLocalDateISO, getCurrentLocalMonthISO } from './utils/dateUtils'; // Adjust path

// Define API Base URL - No change needed
const PAYMENT_TYPES = ['Cash', 'Debit', 'Credit'];

// Mapping for display names - No change needed
const paymentTypeDisplayNames = { Cash: 'เงินสด', Debit: 'เงินโอน', Credit: 'เครดิต' };

// --- Helper Functions (Improved Readability & Robustness) ---
const formatCurrency = (amount) => {
    const num = Number(amount);
    return !isNaN(num) ? num.toFixed(2) : '0.00';
};
const formatDate = (dt) => {
    try {
        return dt ? new Date(dt).toLocaleDateString('en-CA') : 'N/A'; // Use 'en-CA' for YYYY-MM-DD
    } catch {
        return 'Invalid Date';
    }
};
const formatDateTime = (dt) => {
    try {
        return dt ? new Date(dt).toLocaleString('en-CA', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        }) : 'N/A';
    } catch {
        return 'Invalid Date/Time';
    }
};
//const getTodayDateString = () => new Date().toLocaleDateString('en-CA');

const formatDuration = (ms) => {
    if (isNaN(ms) || ms < 0) return 'N/A';
    if (ms === 0) return '0s';
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);
    seconds %= 60;
    minutes %= 60;
    hours %= 24;
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    // Always show seconds if it's the only unit or if other units are present
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
};

const calculateTotal = (items) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + (Number(item?.totalAmount) || 0), 0);
};

// Use display names map, handle null/undefined explicitly
const displayPaymentType = (paymentType) => {
    if (paymentType === null || paymentType === undefined || paymentType === 'null' || paymentType === '') {
        return 'Unspecified';
    }
    return paymentTypeDisplayNames[paymentType] || paymentType; // Fallback to raw value if not in map
};

// Define Product Options - No change needed
const productOptions = [ "น้ำแข็งหลอด", "น้ำแข็งบด", "น้ำแข็งหลอดเล็ก", "น้ำแข็งซอง", "น้ำแข็งกั๊ก" ];

// --- Reusable UI Components (Optional but recommended for larger apps) ---

// Basic Input Field
const InputField = ({ id, label, srLabel = false, className = '', ...props }) => (
    <div>
        <label htmlFor={id} className={`block text-sm font-medium text-zinc-700 ${srLabel ? 'sr-only' : 'mb-1'}`}>
            {label}
        </label>
        <input
            id={id}
            className={`mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-1.5 ${className}`}
            {...props}
        />
    </div>
);

// Basic Select Field
const SelectField = ({ id, label, srLabel = false, className = '', children, ...props }) => (
    <div>
        <label htmlFor={id} className={`block text-sm font-medium text-zinc-700 ${srLabel ? 'sr-only' : 'mb-1'}`}>
            {label}
        </label>
        <select
            id={id}
            className={`mt-1 block w-full rounded-md border-zinc-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-1.5 ${className}`}
            {...props}
        >
            {children}
        </select>
    </div>
);

// Basic Button
const Button = ({ children, variant = 'primary', size = 'md', disabled = false, className = '', ...props }) => {
    const baseStyle = "inline-flex items-center justify-center rounded-md border shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const sizeStyles = {
        sm: 'px-3 py-1 text-xs',
        md: 'px-4 py-1.5 text-sm', // Adjusted default size slightly smaller
        lg: 'px-5 py-2 text-base',
    };
    const variantStyles = {
        primary: 'border-transparent bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
        secondary: 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 focus:ring-indigo-500',
        danger: 'border-transparent bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        success: 'border-transparent bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
        ghost: 'border-transparent bg-transparent text-zinc-600 hover:bg-zinc-100 focus:ring-indigo-500',
        icon: 'p-1 border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 focus:ring-1 focus:ring-inset focus:ring-indigo-500 rounded-full', // Specific for icon buttons
    };

    return (
        <button
            type="button"
            className={`${baseStyle} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    );
};

// Alert Component
const Alert = ({ type = 'error', title, message, onClose }) => {
    const colors = {
        error: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-700', icon: 'text-red-500' },
        success: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700', icon: 'text-green-500' },
    };
    const color = colors[type] || colors.error;

    return (
        <div className={`${color.bg} border ${color.border} ${color.text} px-4 py-3 rounded relative mb-4 flex items-start`} role="alert">
            <div className="flex-grow">
                {title && <strong className="font-bold mr-2">{title}</strong>}
                <span className="block sm:inline">{message}</span>
            </div>
            {onClose && (
                <button onClick={onClose} className={`ml-4 -mt-1 -mr-1 p-1 ${color.icon} hover:opacity-75 focus:outline-none`} aria-label="Close">
                     {/* Simple X icon */}
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            )}
        </div>
    );
};


// --- EditOrderModal Component (Refactored) ---
function EditOrderModal({ isOpen, onClose, orderData, onSave }) {
    const [formData, setFormData] = useState({ customerName: '', paymentType: '', items: [] });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(''); // Local error for modal validation

    useEffect(() => {
        setError(''); // Clear local error when opening/closing or data changes
        if (isOpen && orderData) {
            setFormData({
                customerName: orderData.customerName || '',
                // Handle potential null/undefined consistently
                paymentType: orderData.paymentType ?? '', // Use '' for 'Unspecified' option value
                items: Array.isArray(orderData.items) ? orderData.items.map(item => ({ ...item })) : [],
            });
        } else if (!isOpen) {
            // Reset form when closing
            setFormData({ customerName: '', paymentType: '', items: [] });
        }
    }, [orderData, isOpen]);

    const handleMainFieldChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleItemChange = (index, field, value) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            if (!newItems[index]) return prev; // Should not happen, but safe guard

            newItems[index] = { ...newItems[index], [field]: value };

            // Recalculate total amount when quantity or price changes
            if ((field === 'quantity' || field === 'pricePerUnit')) {
                const qty = parseFloat(newItems[index].quantity) || 0;
                const price = parseFloat(newItems[index].pricePerUnit) || 0;
                newItems[index].totalAmount = qty * price;
            }
            return { ...prev, items: newItems };
        });
    };

    const handleAddItem = () => {
        // Add item with default values, ensures properties exist
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { productType: '', quantity: 1, pricePerUnit: 0, totalAmount: 0 }]
        }));
    };

    const handleRemoveItem = (index) => {
        setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError(''); // Clear previous errors
        setIsSaving(true);

        // Validation before saving
        const itemsToSave = formData.items
            .map(item => ({
                ...item,
                quantity: parseFloat(item.quantity) || 0,
                pricePerUnit: parseFloat(item.pricePerUnit) || 0,
                totalAmount: (parseFloat(item.quantity) || 0) * (parseFloat(item.pricePerUnit) || 0),
                // Ensure productType is not empty
                productType: item.productType || null // Use null if empty to represent unset
            }))
            // Filter out items that are effectively empty or invalid
            .filter(item => item.productType && item.quantity > 0 && item.pricePerUnit >= 0);

        if (itemsToSave.length !== formData.items.length) {
             setError("Please ensure all items have a selected Product Type and valid quantity/price.");
             setIsSaving(false);
             return;
        }

        if (itemsToSave.length === 0 && formData.items.length > 0) {
             setError("Please correct item details or remove empty items.");
             setIsSaving(false);
             return;
        }
         if (itemsToSave.length === 0 && formData.items.length === 0) {
             setError("Order must have at least one item.");
             setIsSaving(false);
             return;
         }


        try {
            const dataToSave = {
                customerName: formData.customerName.trim() || null, // Save null if empty
                // Use null for backend if 'Unspecified' ('') was selected
                paymentType: formData.paymentType === '' ? null : formData.paymentType,
                orderItems: itemsToSave,
            };
            await onSave(orderData.id, dataToSave);
            onClose(); // Close modal on success
        } catch (saveError) {
            // Error should be displayed by the parent component which calls onSave
            // If not, display it locally: setError(`Save failed: ${saveError.message}`);
            console.error("Save error:", saveError);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !orderData) return null;

    return (
        // Use fixed overlay with flexbox centering
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-10 backdrop-blur-sm">
             {/* Modal Panel */}
            <div className="relative w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
                 {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-zinc-200 p-4">
                    <h3 className="text-lg font-medium text-zinc-900">Edit Order #{orderData.id}</h3>
                    <Button variant="icon" onClick={onClose} aria-label="Close modal" className="-mr-2">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"> <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /> </svg>
                    </Button>
                </div>

                {/* Modal Body - Scrollable */}
                <div className="max-h-[70vh] overflow-y-auto p-6">
                    <form onSubmit={handleSave} noValidate> {/* Added noValidate to prevent browser defaults interfering */}
                        <div className="space-y-4">
                            {/* Local Error Display */}
                             {error && <Alert type="error" message={error} onClose={() => setError('')} />}

                            {/* Customer Name - Using InputField Component */}
                            <InputField
                                id="customerName"
                                name="customerName"
                                label="Customer Name"
                                type="text"
                                value={formData.customerName || ''}
                                onChange={handleMainFieldChange}
                            />

                            {/* Payment Type - Using SelectField Component */}
                            <SelectField
                                id="paymentType"
                                name="paymentType"
                                label="Payment Type"
                                value={formData.paymentType || ''} // Ensure controlled component
                                onChange={handleMainFieldChange}
                            >
                                <option value="">Unspecified</option>
                                {/* <option value="null">None</option> // Removed 'None', use Unspecified ('') */}
                                {PAYMENT_TYPES.map(type => (
                                    <option key={type} value={type}>{paymentTypeDisplayNames[type] || type}</option>
                                ))}
                            </SelectField>

                            {/* Order Items Section */}
                            <div className="mt-6 border-t border-zinc-200 pt-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-md font-medium text-zinc-800">Order Items</h4>
                                    {/* Add Item Button - Moved near title */}
                                     <Button variant="success" size="sm" onClick={handleAddItem}>
                                         <svg className="-ml-0.5 mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                         Add Item
                                     </Button>
                                </div>

                                {formData.items.length === 0 ? (
                                    <p className="mt-3 rounded border border-dashed border-zinc-300 bg-zinc-50 py-4 text-center text-sm text-zinc-500">
                                        No items added yet.
                                    </p>
                                ) : (
                                    <div className="mt-3 space-y-3">
                                        {formData.items.map((item, index) => (
                                            <div key={index} className="grid grid-cols-12 items-center gap-x-2 gap-y-1 rounded border border-zinc-200 bg-zinc-50/50 p-2">
                                                {/* Product Type */}
                                                <div className="col-span-12 sm:col-span-4">
                                                    <SelectField
                                                        id={`item-type-${index}`}
                                                        srLabel // Screen reader only label
                                                        label={`Item ${index + 1} Product Type`}
                                                        value={item.productType || ''}
                                                        onChange={(e) => handleItemChange(index, 'productType', e.target.value)}
                                                        className="sm:text-xs py-1" // Smaller text on small inputs
                                                    >
                                                        <option value="" disabled>-- Select Product --</option>
                                                        {productOptions.map(opt => ( <option key={opt} value={opt}>{opt}</option> ))}
                                                    </SelectField>
                                                </div>
                                                {/* Quantity */}
                                                <div className="col-span-4 sm:col-span-2">
                                                    <InputField
                                                         id={`item-qty-${index}`}
                                                         srLabel
                                                         label={`Item ${index + 1} Quantity`}
                                                         type="number"
                                                         placeholder="Qty"
                                                         min="0" step="any" // Allow decimals if needed
                                                         value={item.quantity || ''}
                                                         onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                         className="sm:text-xs py-1"
                                                    />
                                                </div>
                                                {/* Price Per Unit */}
                                                <div className="col-span-5 sm:col-span-3">
                                                     <InputField
                                                         id={`item-price-${index}`}
                                                         srLabel
                                                         label={`Item ${index + 1} Price Per Unit`}
                                                         type="number"
                                                         placeholder="Price/Unit"
                                                         min="0" step="0.01"
                                                         value={item.pricePerUnit || ''}
                                                         onChange={(e) => handleItemChange(index, 'pricePerUnit', e.target.value)}
                                                         className="sm:text-xs py-1"
                                                     />
                                                </div>
                                                 {/* Total Amount (Readonly) */}
                                                <div className="col-span-3 sm:col-span-2 flex items-center justify-end text-xs text-zinc-600 pr-1">
                                                    {formatCurrency(item.totalAmount)}&nbsp;฿
                                                </div>
                                                {/* Remove Button */}
                                                <div className="col-span-12 sm:col-span-1 flex justify-end sm:justify-center mt-1 sm:mt-0">
                                                    <Button
                                                        variant="icon"
                                                        onClick={() => handleRemoveItem(index)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-100"
                                                        title="Remove Item"
                                                        aria-label={`Remove item ${index + 1}`}
                                                    >
                                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                 {/* Modal Footer */}
                <div className="flex justify-end space-x-3 border-t border-zinc-200 bg-zinc-50 p-4">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </div>
    );
}


// --- OrderRow Component (Refactored) ---
function OrderRow({ order, isExpanded, onToggleExpand, onEdit, onDelete, onPrint }) {
    const total = useMemo(() => calculateTotal(order.items), [order.items]);
    const timeToCompletion = useMemo(() => {
        if (order.status === 'Completed' && order.createdAt && order.statusUpdatedAt) {
            try {
                const created = new Date(order.createdAt);
                const completed = new Date(order.statusUpdatedAt);
                if (!isNaN(created.getTime()) && !isNaN(completed.getTime())) {
                    const diffMs = completed.getTime() - created.getTime();
                    return diffMs >= 0 ? formatDuration(diffMs) : 'N/A'; // Ensure non-negative duration
                }
            } catch { /* Ignore date parsing errors */ }
        }
        return null; // Return null if not applicable
    }, [order.status, order.createdAt, order.statusUpdatedAt]);

    // Prevent row click propagation when clicking buttons
    const handleButtonClick = (e, action) => {
        e.stopPropagation();
        action();
    };

    const {
        id, customerName, createdAt, paymentType, items = [],
        driverName = 'N/A', status = 'N/A', statusUpdatedAt
    } = order; // Destructure for cleaner access

    return (
        <>
            {/* Main Order Row - Added hover group for potential future hover effects on buttons */}
            <tr
                key={id}
                className="group border-b border-zinc-200 last:border-b-0 hover:bg-zinc-50/75 transition-colors duration-150 cursor-pointer text-sm text-zinc-700"
                onClick={() => onToggleExpand(id)}
            >
                 {/* Expand Icon Cell */}
                 <td className="w-10 px-3 py-2.5 text-center">
                     <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                 </td>
                 {/* Data Cells */}
                 <td className="px-3 py-2.5 whitespace-nowrap font-medium text-zinc-800">{id}</td>
                 <td className="px-3 py-2.5">{customerName || <span className="text-zinc-400 italic">None</span>}</td>
                 <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(createdAt)}</td>
                 <td className="px-3 py-2.5">{displayPaymentType(paymentType)}</td>
                 <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(total)}&nbsp;฿</td>
                 {/* Actions Cell - Using Icon Buttons */}
                 <td className="px-3 py-2.5 whitespace-nowrap text-right">
                     <div className="flex items-center justify-end space-x-1">
                         {/* Print Button */}
                         <Button variant="icon" size="sm" onClick={(e) => handleButtonClick(e, () => onPrint(id))} title={`Print Bill #${id}`}>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /> </svg>
                         </Button>
                         {/* Edit Button */}
                         <Button variant="icon" size="sm" onClick={(e) => handleButtonClick(e, () => onEdit(id))} title={`Edit Order #${id}`} className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /> </svg>
                         </Button>
                         {/* Delete Button */}
                         <Button variant="icon" size="sm" onClick={(e) => handleButtonClick(e, () => onDelete(id))} title={`Delete Order #${id}`} className="text-red-600 hover:text-red-800 hover:bg-red-100">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /> </svg>
                         </Button>
                     </div>
                 </td>
            </tr>

            {/* Collapsible Details Row */}
            {isExpanded && (
                <tr key={`${id}-details`} className="bg-zinc-50">
                    <td></td>{/* Spacer cell */}
                    <td colSpan="6" className="px-4 py-3 text-xs">
                        <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {/* Items Details */}
                            <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 mb-1">
                                <h4 className="font-semibold text-zinc-700 mb-0.5">Items:</h4>
                                {items.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-0.5 pl-1 text-zinc-600">
                                        {items.map(item => (
                                            <li key={item.id || item.productId}>
                                                {item.productType || 'N/A'} (x{item.quantity || 0}) @ {formatCurrency(item.pricePerUnit)}&nbsp;฿ = <span className="font-medium">{formatCurrency(item.totalAmount)}&nbsp;฿</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="italic text-zinc-500">No item details available.</p>
                                )}
                            </div>
                             {/* Other Details */}
                            <DetailItem label="Customer" value={customerName || 'N/A'} />
                            <DetailItem label="Payment" value={displayPaymentType(paymentType)} />
                            <DetailItem label="Driver" value={driverName} />
                            <DetailItem label="Status" value={status} />
                            <DetailItem label="Created" value={formatDateTime(createdAt)} />
                            <DetailItem label="Last Update" value={formatDateTime(statusUpdatedAt)} />
                            {timeToCompletion && <DetailItem label="Completion Time" value={timeToCompletion} />}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// Helper for detail rows
const DetailItem = ({ label, value }) => (
    <div>
        <strong className="font-medium text-zinc-600">{label}:</strong>
        <span className="ml-1 text-zinc-800">{value}</span>
    </div>
);

// --- Main AdminPanel Component (Refactored) ---
export default function AdminPanel() {
    const [orders, setOrders] = useState([]);
    const [selectedDate, setSelectedDate] = useState(getCurrentLocalDateISO());
    const [dailyDate, setDailyDate] = useState(getCurrentLocalDateISO());
    const [dailyReport, setDailyReport] = useState(null);
    const [monthlyMonth, setMonthlyMonth] = useState(getCurrentLocalMonthISO());
    const [monthlyReport, setMonthlyReport] = useState(null);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [loadingDaily, setLoadingDaily] = useState(false);
    const [loadingMonthly, setLoadingMonthly] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [orderSearchTerm, setOrderSearchTerm] = useState('');
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);

    useEffect(() => {
        let timer;
        if (successMessage) {
            timer = setTimeout(() => setSuccessMessage(''), 4000);
        } else if (error) {
            // timer = setTimeout(() => setError(''), 7000); // Optional: auto-clear errors
        }
        return () => clearTimeout(timer);
    }, [successMessage, error]);

    const handleAuthError = useCallback((err) => {
        if (err.status === 401) {
            console.warn('Authentication error detected in AdminPanel:', err.message);
            setError(''); // Clear local error before redirect
            localStorage.removeItem('authToken');
            localStorage.removeItem('authUser');
            window.location.href = '/login'; // Redirect to login
            return true; // Error was handled (auth-related)
        } else if (err.status === 403) {
            setError('Forbidden: You do not have permission for this action.');
            return true; // Error was handled (auth-related)
        }
        // For other errors, let the caller handle setting a more specific message
        return false; // Error was not an auth/permission error handled here
    }, [setError]); // setError is stable

    const fetchOrders = useCallback(async (showLoading = true) => {
        if (showLoading) setLoadingOrders(true);
        setError('');
        try {
            console.log(`Workspaceing orders for date: ${selectedDate}`);
            const { data } = await request(`/orders?date=${selectedDate}`);
            const processedOrders = (Array.isArray(data) ? data : []).map(o => ({
                ...o,
                items: Array.isArray(o.items) ? o.items : [],
            }));
            setOrders(processedOrders);
        } catch (err) {
            console.error("Fetch orders error in AdminPanel:", err);
            if (!handleAuthError(err)) {
                setError(`Failed to fetch orders: ${err.message || 'Unknown error'}`);
            }
            setOrders([]);
        } finally {
            if (showLoading) setLoadingOrders(false);
        }
    }, [selectedDate, handleAuthError, setLoadingOrders, setError, setOrders]);

    useEffect(() => {
        console.log("AdminPanel: useEffect a_sync_with_selectedDate triggered, calling fetchOrders.");
        fetchOrders();
    }, [fetchOrders]); // Correct: depends on the memoized fetchOrders

    const deleteOrder = useCallback(async (id) => {
        if (!window.confirm(`Are you sure you want to permanently delete order #${id}? This cannot be undone.`)) return;
        setError('');
        setSuccessMessage('');
        try {
            await request(`/orders/${id}`, 'DELETE');
            setSuccessMessage(`Order #${id} deleted successfully.`);
            setExpandedOrderId(null);
            fetchOrders(false); // Refetch
        } catch (err) {
            console.error("Delete order error in AdminPanel:", err);
            if (!handleAuthError(err)) {
                setError(`Failed to delete order #${id}: ${err.message || 'Unknown error'}`);
            }
        }
    }, [handleAuthError, fetchOrders, setError, setSuccessMessage, setExpandedOrderId]);

    const handleSaveOrder = useCallback(async (orderId, updatedData) => {
        setError('');
        setSuccessMessage('');
        try {
            const { data: result } = await request(`/orders/${orderId}`, 'PUT', updatedData);
            setSuccessMessage(result?.message || `Order #${orderId} updated successfully.`);
            fetchOrders(false); // Refetch
            // No need to return Promise.resolve(), modal can close based on no error
        } catch (err) {
            console.error(`Save order #${orderId} error in AdminPanel:`, err);
            if (!handleAuthError(err)) {
                setError(`Failed to save order #${orderId}: ${err.message || 'Unknown error'}`);
            }
            throw err; // Re-throw for the modal to know save failed
        }
    }, [handleAuthError, fetchOrders, setError, setSuccessMessage]);

    const getDailyReport = useCallback(async () => {
        if (!dailyDate) { setError("Please select a date for the daily report."); return; }
        setLoadingDaily(true);
        setDailyReport(null);
        setError('');
        setSuccessMessage('');
        try {
            const { data } = await request(`/reports/daily?date=${dailyDate}`);
            setDailyReport(data);
        } catch (err) {
            console.error("Daily report fetch error in AdminPanel:", err);
            if (!handleAuthError(err)) {
                setError(`Failed to fetch daily report: ${err.message || 'Unknown error'}`);
            }
        } finally {
            setLoadingDaily(false);
        }
    }, [dailyDate, handleAuthError, setLoadingDaily, setDailyReport, setError, setSuccessMessage]);

    const getMonthlyReport = useCallback(async () => {
        if (!monthlyMonth) { setError("Please select a month for the monthly report."); return; }
        setLoadingMonthly(true);
        setMonthlyReport(null);
        setError('');
        setSuccessMessage('');
        try {
            const { data } = await request(`/reports/monthly?month=${monthlyMonth}`);
            setMonthlyReport(data);
        } catch (err) {
            console.error("Monthly report fetch error in AdminPanel:", err);
            if (!handleAuthError(err)) {
                setError(`Failed to fetch monthly report: ${err.message || 'Unknown error'}`);
            }
        } finally {
            setLoadingMonthly(false);
        }
    }, [monthlyMonth, handleAuthError, setLoadingMonthly, setMonthlyReport, setError, setSuccessMessage]);


    // Other handlers like handleOpenEditModal, handleCloseEditModal, handleToggleExpand, handlePrintOrder
    // seem less likely to cause TDZ unless they access uninitialized state in a strange way.
    // Their dependencies also need to be checked if they use component scope variables.
     const handleOpenEditModal = useCallback((orderId) => {
        setError('');
        setSuccessMessage('');
        const orderToEdit = orders.find(o => o.id === orderId);
        if (orderToEdit) {
            setEditingOrder(orderToEdit);
            setIsEditModalOpen(true);
        } else {
            setError(`Error: Could not find order data for ID ${orderId}. Please refresh.`);
        }
    }, [orders, setEditingOrder, setIsEditModalOpen, setError, setSuccessMessage]);

    const handleCloseEditModal = useCallback(() => {
        setIsEditModalOpen(false);
        setEditingOrder(null);
    }, [setIsEditModalOpen, setEditingOrder]);

    const handleToggleExpand = useCallback((orderId) => {
        setExpandedOrderId(prevId => (prevId === orderId ? null : prevId));
    }, [setExpandedOrderId]);

    const handlePrintOrder = useCallback((orderId) => {
        setError('');
        setSuccessMessage('');
        try {
            const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
            const printUrl = `${VITE_API_BASE_URL}/print-bill/${orderId}`.replace('/api', '');
            const printWindow = window.open(printUrl, '_blank', 'noopener,noreferrer,width=800,height=600');
            if (!printWindow) {
                throw new Error("Popup blocked? Please allow popups for this site.");
            }
        } catch (e) {
            console.error("Print URL error:", e);
            setError(`Could not open print window: ${e.message}`);
        }
    }, [setError, setSuccessMessage]);


    const filteredOrders = useMemo(() => {
        const term = orderSearchTerm.toLowerCase().trim();
        if (!term) return orders;
        return orders.filter(o =>
            String(o.id).includes(term) ||
            o.customerName?.toLowerCase().includes(term)
        );
    }, [orders, orderSearchTerm]);

    // --- Render JSX ---
    return (
         // Use a semantic container, improved padding and background
        <div className="min-h-screen bg-zinc-100 p-4 font-sans sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl"> {/* Optional: Constrain width on very large screens */}
                {/* Page Header */}
                <header className="mb-6 border-b border-zinc-300 pb-3">
                    <h1 className="text-2xl font-bold text-zinc-800 md:text-3xl">Admin Dashboard</h1>
                </header>

                 {/* Global Messages Area */}
                <div className="mb-4 space-y-3">
                     {error && <Alert type="error" title="Error:" message={error} onClose={() => setError('')} />}
                     {successMessage && <Alert type="success" title="Success:" message={successMessage} onClose={() => setSuccessMessage('')} />}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

                    {/* Section: Manage Orders (Spans 2 columns on large screens) */}
                    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm lg:col-span-3">
                         {/* Section Header */}
                        <div className="flex flex-col gap-4 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-xl font-semibold text-zinc-700">Manage Orders</h2>
                            {/* Filters */}
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                                <InputField
                                     id="order-date-filter"
                                     label="Order Date:"
                                     type="date"
                                     value={selectedDate}
                                     onChange={(e) => setSelectedDate(e.target.value)}
                                     className="py-1 text-sm" // Slightly smaller date input
                                />
                                <InputField
                                    id="order-search"
                                    label="Search Orders:"
                                    srLabel // Hide label visually
                                    type="search" // Use search type for potential clear button
                                    placeholder="Search by ID or Name..."
                                    value={orderSearchTerm}
                                    onChange={(e) => setOrderSearchTerm(e.target.value)}
                                    className="w-full py-1 text-sm sm:w-48"
                                />
                            </div>
                        </div>
                        {/* Orders Table Area */}
                        <div className="p-4">
                            {loadingOrders ? (
                                <p className="py-8 text-center text-zinc-500">Loading orders for {formatDate(selectedDate)}...</p>
                            ) : (
                                <div className="max-h-[65vh] overflow-x-auto overflow-y-auto rounded border border-zinc-200">
                                    <table className="min-w-full table-fixed divide-y divide-zinc-200 text-left text-sm">
                                        <thead className="sticky top-0 z-10 bg-zinc-100/75 backdrop-blur-sm">
                                            <tr>
                                                <th className="w-10 px-3 py-2"></th>{/* Expander */}
                                                 {/* Adjusted column widths and titles */}
                                                <th scope="col" className="w-16 px-3 py-2 font-medium text-zinc-600">ID</th>
                                                <th scope="col" className="w-1/4 px-3 py-2 font-medium text-zinc-600">Customer</th>
                                                <th scope="col" className="w-28 px-3 py-2 font-medium text-zinc-600">Date</th>
                                                <th scope="col" className="w-24 px-3 py-2 font-medium text-zinc-600">Payment</th>
                                                <th scope="col" className="w-24 px-3 py-2 text-right font-medium text-zinc-600">Total</th>
                                                <th scope="col" className="w-28 px-3 py-2 text-right font-medium text-zinc-600">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-200 bg-white">
                                            {filteredOrders.length > 0 ? (
                                                filteredOrders.map(o => (
                                                    <OrderRow
                                                        key={o.id}
                                                        order={o}
                                                        isExpanded={expandedOrderId === o.id}
                                                        onToggleExpand={handleToggleExpand}
                                                        onEdit={handleOpenEditModal}
                                                        onDelete={deleteOrder}
                                                        onPrint={handlePrintOrder}
                                                    />
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="7" className="py-6 text-center text-zinc-500">
                                                        {orders.length === 0 ? `No orders found for ${formatDate(selectedDate)}.` : 'No orders match your search criteria.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Section: Daily Report */}
                    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                        <h2 className="mb-3 border-b border-zinc-200 pb-2 text-lg font-semibold text-zinc-700">Daily Financial Report</h2>
                        <div className="mb-4 flex flex-wrap items-end gap-3">
                            <InputField
                                id="daily-date"
                                label="Select Date:"
                                type="date"
                                value={dailyDate}
                                onChange={e => setDailyDate(e.target.value)}
                                className="py-1 text-sm"
                            />
                            <Button variant="primary" size="md" onClick={getDailyReport} disabled={loadingDaily || !dailyDate}>
                                {loadingDaily ? 'Fetching...' : 'Fetch Report'}
                            </Button>
                        </div>
                        {/* Report Display Area */}
                        <div className="mt-4 min-h-[100px] text-sm">
                            {loadingDaily && <p className="text-zinc-500">Loading report...</p>}
                            {!loadingDaily && dailyReport && (
                                <div className="space-y-1 rounded-md border border-zinc-200 bg-zinc-50/50 p-3 text-zinc-700">
                                    <DetailItem label="Date" value={formatDate(dailyReport.date)} />
                                    <DetailItem label="Total Orders" value={dailyReport.totalOrders} />
                                    <DetailItem label="Total Revenue" value={`${formatCurrency(dailyReport.totalRevenue)} ฿`} />
                                    <hr className="my-2 border-t border-zinc-200"/>
                                    <DetailItem label="Cash Sales" value={`${formatCurrency(dailyReport.cashSales)} ฿`} />
                                    <DetailItem label="Debit Sales" value={`${formatCurrency(dailyReport.debitSales)} ฿`} />
                                    <DetailItem label="Credit Sales" value={`${formatCurrency(dailyReport.creditSales)} ฿`} />
                                    <DetailItem label="Unspecified" value={`${formatCurrency(dailyReport.unspecifiedSales)} ฿`} />
                                </div>
                            )}
                             {!loadingDaily && !dailyReport && !error.includes('daily report') && (
                                <p className="text-zinc-500">Select a date and fetch the report.</p>
                             )}
                        </div>
                    </section>

                    {/* Section: Monthly Report */}
                    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm lg:col-span-2"> {/* Span 2 cols on large */}
                        <h2 className="mb-3 border-b border-zinc-200 pb-2 text-lg font-semibold text-zinc-700">Monthly Financial Report</h2>
                        <div className="mb-4 flex flex-wrap items-end gap-3">
                             <InputField
                                id="monthly-month"
                                label="Select Month:"
                                type="month" // Use type="month"
                                value={monthlyMonth}
                                onChange={e => setMonthlyMonth(e.target.value)}
                                className="py-1 text-sm"
                            />
                            <Button variant="primary" size="md" onClick={getMonthlyReport} disabled={loadingMonthly || !monthlyMonth}>
                                {loadingMonthly ? 'Fetching...' : 'Fetch Report'}
                            </Button>
                        </div>
                         {/* Report Display Area */}
                        <div className="mt-4 min-h-[150px]">
                            {loadingMonthly && <p className="text-sm text-zinc-500">Loading report...</p>}
                            {!loadingMonthly && monthlyReport && (
                                <div>
                                    {/* Monthly Summary */}
                                    <h3 className="mb-2 text-md font-semibold text-zinc-700">
                                        Summary for {monthlyReport.month /* Assuming API returns formatted month like YYYY-MM */}
                                    </h3>
                                    <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-700 sm:grid-cols-3">
                                        <DetailItem label="Total Orders" value={monthlyReport.summary?.totalOrders ?? 0} />
                                        <DetailItem label="Total Revenue" value={`${formatCurrency(monthlyReport.summary?.totalRevenue)} ฿`} />
                                        <DetailItem label="Cash Sales" value={`${formatCurrency(monthlyReport.summary?.cashSales)} ฿`} />
                                        <DetailItem label="Debit Sales" value={`${formatCurrency(monthlyReport.summary?.debitSales)} ฿`} />
                                        <DetailItem label="Credit Sales" value={`${formatCurrency(monthlyReport.summary?.creditSales)} ฿`} />
                                        <DetailItem label="Unspecified" value={`${formatCurrency(monthlyReport.summary?.unspecifiedSales)} ฿`} />
                                    </div>
                                     {/* Daily Breakdown Table */}
                                    <h4 className="mb-1 text-md font-semibold text-zinc-700">Daily Breakdown</h4>
                                    {monthlyReport.dailyData?.length > 0 ? (
                                        <div className="max-h-60 overflow-y-auto rounded border border-zinc-200 text-xs">
                                            <table className="min-w-full border-collapse">
                                                <thead className="sticky top-0 bg-zinc-100/75 backdrop-blur-sm">
                                                    <tr>
                                                        {['Date','Orders','Revenue','Cash','Debit','Credit', 'Unspec.'].map(col => (
                                                            <th key={col} scope="col" className="border-b border-zinc-300 px-2 py-1.5 text-left font-medium text-zinc-600">{col}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-200 bg-white">
                                                    {monthlyReport.dailyData.map(row => (
                                                        <tr key={row.date} className="hover:bg-zinc-50">
                                                            <td className="whitespace-nowrap px-2 py-1 text-zinc-700">{formatDate(row.date)}</td>
                                                            <td className="px-2 py-1 text-right text-zinc-700">{row.orderCount}</td>
                                                            <td className="px-2 py-1 text-right text-zinc-700 font-mono">{formatCurrency(row.totalAmount)}</td>
                                                            <td className="px-2 py-1 text-right text-zinc-700 font-mono">{formatCurrency(row.cashSales)}</td>
                                                            <td className="px-2 py-1 text-right text-zinc-700 font-mono">{formatCurrency(row.debitSales)}</td>
                                                            <td className="px-2 py-1 text-right text-zinc-700 font-mono">{formatCurrency(row.creditSales)}</td>
                                                            <td className="px-2 py-1 text-right text-zinc-700 font-mono">{formatCurrency(row.unspecifiedSales)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-zinc-500">No daily data available for this month.</p>
                                    )}
                                </div>
                            )}
                             {!loadingMonthly && !monthlyReport && !error.includes('monthly report') && (
                                <p className="text-sm text-zinc-500">Select a month and fetch the report.</p>
                             )}
                        </div>
                    </section>
                </div> {/* End Main Content Grid */}

                {/* Render Edit Modal */}
                <EditOrderModal
                    isOpen={isEditModalOpen}
                    onClose={handleCloseEditModal}
                    orderData={editingOrder}
                    onSave={handleSaveOrder} // Pass the handler here
                 />
            </div> {/* End Max Width Container */}
        </div> // End Root Div
    );
}