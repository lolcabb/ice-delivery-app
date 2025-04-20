import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

function numberToThaiText(number) {
  const txtNumArr = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
  const txtDigitArr = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const bahtText = (num) => {
    let text = '';
    num = num.toString();
    if (isNaN(num) || num === '') return '';

    let [integer] = num.split('.');
    let len = integer.length;

    for (let i = 0; i < len; i++) {
      let n = parseInt(integer.charAt(i));
      if (n !== 0) {
        if (i === len - 1 && n === 1 && len > 1) text += 'เอ็ด';
        else if (i === len - 2 && n === 2) text += 'ยี่';
        else if (i === len - 2 && n === 1) text += '';
        else text += txtNumArr[n];
        text += txtDigitArr[len - i - 1];
      }
    }
    return text + 'บาทถ้วน';
  };

  return bahtText(number);
}

export default function PrintOrder() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`http://localhost:4000/api/orders/${orderId}`, {
      headers: { userId: 1 }
    })
      .then(res => res.json())
      .then(data => {
        if (data.message) throw new Error(data.message);
        setOrder(data);
        setTimeout(() => window.print(), 500);
      })
      .catch(err => setError(err.message));
  }, [orderId]);

  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!order) return <div className="p-6">Loading...</div>;

  const total = order.items.reduce((sum, item) => sum + item.totalAmount, 0);
  const thaiTextTotal = numberToThaiText(total);

  const productMap = {
    'Product A': { quantity: 0, price: 0 },
    'Product B': { quantity: 0, price: 0 },
    'Product C': { quantity: 0, price: 0 },
    'Product D': { quantity: 0, price: 0 },
    'Product E': { quantity: 0, price: 0 }
  };

  order.items.forEach(item => {
    if (productMap[item.productType]) {
      productMap[item.productType].quantity = item.quantity;
      productMap[item.productType].price = item.pricePerUnit;
    }
  });

  return (
    <div className="p-4 w-[900px] mx-auto font-mono text-sm">
      <style>{`
        @media print {
          .product-header th,
          .product-header td,
          .product-line td,
          .totals-row td,
          .signature-line td,
          .signatures td {
            border: 1px solid black !important;
            border-collapse: collapse !important;
          }
        }
        .invoice-table {
          width: 100%;
          font-size: 0.875rem;
          border-collapse: collapse;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .label { font-weight: bold; }
        .value { font-weight: normal; }
        .company-name { font-weight: bold; font-size: 1.25rem; text-align: center; }
        .signature-line td { padding-top: 1.5rem; padding-bottom: 0.25rem; text-align: center; }
      `}</style>

      <table className="invoice-table">
        <colgroup>
          <col className="col-description" />
          <col className="col-detail" />
          <col className="col-quantity-role" />
          <col className="col-price-role" />
          <col className="col-spacer-mid" />
          <col className="col-total" />
        </colgroup>
        <tbody>
          <tr><td></td>
            <td className="label text-right">Order</td>
            <td className="value text-right">{order.id}</td>
          </tr>
          <tr>
            <td></td><td></td>
            <td colSpan={3} className="company-name">Ice Company</td>
            <td></td><td></td>
          </tr>
          <tr><td colSpan={7}>&nbsp;</td></tr>
          <tr>
            <td></td><td></td><td></td><td></td>
            <td className="label text-right">Date</td>
            <td className="value">{new Date(order.createdAt).toLocaleDateString('th-TH')}</td>
            <td className="value">{new Date(order.createdAt).toLocaleTimeString()}</td>
          </tr>
          <tr>
            <td></td>
            <td className="label">Customer</td>
            <td className="value" colSpan={2}>{order.customerName}</td>
            <td></td><td></td><td></td>
          </tr>
          <tr><td colSpan={7}>&nbsp;</td></tr>

          <tr className="product-header">
  <th colSpan={2}>Product</th>
  <th className="text-center">Quantity</th>
  <th className="text-center">Price Per Unit</th>
  <th></th>
  <th className="text-right">Total</th>
          </tr>

          {Object.entries(productMap).map(([product, data]) => (
            <tr key={product} className="product-line">
              <td></td>
              <td>{product}</td>
              <td></td>
              <td className="text-center">{data.quantity}</td>
              <td className="text-center">{data.price}</td>
              <td></td>
              <td className="text-right">{(data.quantity * data.price).toFixed(2)}</td>
            </tr>
          ))}

          <tr className="totals-row">
            <td></td><td></td><td></td>
            <td>{thaiTextTotal}</td><td></td>
            <td className="label text-right">Net Total</td>
            <td className="value text-right">{total.toFixed(2)}</td>
          </tr>

          <tr className="signature-line">
            <td></td>
            <td>..................</td>
            <td>..................</td>
            <td>{order.driverName || '..................'}</td>
            <td>..................</td>
            <td></td><td></td>
          </tr>
          <tr className="signatures">
            <td></td>
            <td className="label">Receiver</td>
            <td className="label">Checker</td>
            <td className="label">Driver</td>
            <td className="label">Issuer</td>
            <td></td><td></td>
          </tr>
          <tr><td colSpan={7}>&nbsp;</td></tr>
        </tbody>
      </table>
    </div>
  );
}
