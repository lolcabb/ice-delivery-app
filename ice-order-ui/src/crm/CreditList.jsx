// ice-delivery-app/ice-order-ui/src/crm/CreditList.jsx
import React from 'react';

const formatCurrency = (amount) => `฿${parseFloat(amount || 0).toFixed(2)}`;

const CreditList = ({ sales, selectedSaleIds, setSelectedSaleIds }) => {
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allIds = new Set(sales.map(s => s.sale_id));
            setSelectedSaleIds(allIds);
        } else {
            setSelectedSaleIds(new Set());
        }
    };

    const handleSelectOne = (saleId) => {
        const newSet = new Set(selectedSaleIds);
        if (newSet.has(saleId)) {
            newSet.delete(saleId);
        } else {
            newSet.add(saleId);
        }
        setSelectedSaleIds(newSet);
    };

    if (sales.length === 0) {
        return <div className="p-4 text-center border rounded-md bg-gray-50">ลูกค้ารายนี้ไม่มีเครดิตการขายค้างอยู่</div>
    }

    return (
        <div className="border rounded-md">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="p-2 w-10 text-center">
                            <input type="checkbox" onChange={handleSelectAll} checked={selectedSaleIds.size === sales.length && sales.length > 0} />
                        </th>
                        <th className="p-2 text-left">วันที่ขาย</th>
                        <th className="p-2 text-left">Sale ID</th>
                        <th className="p-2 text-right">จำนวนเงิน</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {sales.map(sale => (
                        <tr key={sale.sale_id} className={`hover:bg-blue-50 ${selectedSaleIds.has(sale.sale_id) ? 'bg-blue-100' : ''}`}>
                            <td className="p-2 text-center">
                                <input type="checkbox" onChange={() => handleSelectOne(sale.sale_id)} checked={selectedSaleIds.has(sale.sale_id)} />
                            </td>
                            <td className="p-2">{new Date(sale.sale_timestamp).toLocaleDateString('th-TH')}</td>
                            <td className="p-2">#{sale.sale_id}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(sale.total_sale_amount)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CreditList;