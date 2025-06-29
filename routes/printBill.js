// routes/printBill.js (Refactored for PostgreSQL + Aliases)
const express = require('express');
const router = express.Router();
const path = require('path');
// Use the PostgreSQL connection pool module
const db = require('../db/postgres');
// const { authMiddleware } = require('../middleware/auth'); // Import auth middleware

router.get('/:id', async (req, res) => { // No authMiddleware
    const orderIdStr = req.params.id;
    console.log(`Received GET /print-bill/${orderIdStr} request`);

    if (!/^\d+$/.test(orderIdStr)) {
        return res.status(400).send('Invalid order ID format');
    }
    const orderId = parseInt(orderIdStr, 10);

    try {
        // Fetch order and items using the pool, adding aliases for camelCase
        const orderQuery = `
            SELECT id, customername AS "customerName", address, phone,
                   drivername AS "driverName", status, issuer, createdat AS "createdAt",
                   statusupdatedat AS "statusUpdatedAt", paymenttype AS "paymentType"
            FROM orders
            WHERE id = $1`; // Alias added
        const itemsQuery = `
            SELECT id, orderid AS "orderId", producttype AS "productType",
                   quantity, priceperunit AS "pricePerUnit", totalamount AS "totalAmount"
            FROM order_items
            WHERE orderid = $1`; // Alias added (use lowercase orderid for WHERE)

        // Execute queries concurrently
        const [orderResult, itemsResult] = await Promise.all([
            db.query(orderQuery, [orderId]),
            db.query(itemsQuery, [orderId])
        ]);

        // Access data using camelCase keys thanks to aliases
        const order = orderResult.rows[0];
        const orderItems = itemsResult.rows;

        if (!order) {
            console.log(`Order ${orderId} not found for printing.`);
            return res.status(404).send('Order not found');
        }

        console.log(`Rendering bill preview for order ${orderId}`);
        // Render the EJS template, passing camelCase data
        // IMPORTANT: Ensure your 'bill-preview.ejs' template now uses camelCase variables
        // e.g., order.customerName, order.createdAt, item.productType, item.totalAmount etc.
        res.render('bill-preview', {
            order, // Pass the order data with camelCase keys
            orderItems, // Pass the items data with camelCase keys
            formatDate: (dt) => dt ? new Date(dt).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'N/A',
            toBahtText: (num) => numberToThaiText(parseFloat(num))
        });

    } catch (err) {
        console.error(`Error fetching data for print bill ${orderId}:`, err);
        res.status(500).send('Failed to retrieve order details for printing');
    }
});

// --- Thai Baht Text Function (remains the same) ---
function numberToThaiText(number) {
    // ... (keep the existing function as provided before) ...
    const txtNumArr = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const txtDigitArr = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    let bahtText = '';
    if (isNaN(number)) return '';
    let numAsNumber = Number(number);
    if (isNaN(numAsNumber)) return '';
    let [baht, satang] = numAsNumber.toFixed(2).split('.');
    const convert = (numStr) => {
        let result = '';
        for (let i = 0; i < numStr.length; i++) {
            let n = parseInt(numStr.charAt(i));
            if (n !== 0) {
                if (i === numStr.length - 1 && n === 1 && numStr.length > 1 && numStr.charAt(numStr.length - 2) !== '0') { result += 'เอ็ด'; }
                else if (i === numStr.length - 2 && n === 2) { result += 'ยี่'; }
                else if (i === numStr.length - 2 && n === 1) { result += ''; }
                else { result += txtNumArr[n]; }
                result += txtDigitArr[numStr.length - i - 1];
            }
        }
        if (numStr.length === 2 && numStr.charAt(0) === '1' && numStr.charAt(1) === '0') { result = 'สิบ'; }
        return result;
    };
    if (baht === '0') { if (satang === '00') { bahtText = 'ศูนย์บาทถ้วน'; } else { bahtText = ''; } }
    else { bahtText += convert(baht) + 'บาท'; }
    if (satang === '00' && baht !== '0') { bahtText += 'ถ้วน'; }
    else if (satang !== '00') { bahtText += convert(satang) + 'สตางค์'; }
    return bahtText;
}
// --- End Thai Baht Text Function ---

module.exports = router;
