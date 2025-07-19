import React from 'react';

export default function PaymentMethodBadge({ isPettyCash, paymentMethod }) {
    if (isPettyCash) {
        return (
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                เงินสดย่อย
            </div>
        );
    }

    return (
        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            {paymentMethod || 'โอนธนาคาร'}
        </div>
    );
}
