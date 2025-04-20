// 📁 File: routes/printBill.js
const express = require('express');
const router = express.Router();
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '../ice.db'));

router.get('/:id', (req, res) => {
  const orderId = req.params.id;

  const orderStmt = db.prepare('SELECT * FROM orders WHERE id = ?');
  const order = orderStmt.get(orderId);

  const itemsStmt = db.prepare('SELECT * FROM order_items WHERE orderId = ?');
  const orderItems = itemsStmt.all(orderId);

  if (!order) return res.status(404).send('Order not found');

  res.render('bill-preview', {
    order,
    orderItems,
    formatDate: (dt) => new Date(dt).toLocaleString('th-TH'),
    toBahtText: (num) => numberToThaiText(parseFloat(num))
  });
});

function numberToThaiText(number) {
  const txtNumArr = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const txtDigitArr = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  let bahtText = '';

  if (isNaN(number)) return '';

  let [baht, satang] = number.toFixed(2).split('.');

  const convert = (numStr) => {
    let result = '';
    for (let i = 0; i < numStr.length; i++) {
      let n = parseInt(numStr.charAt(i));
      if (n !== 0) {
        if (i === numStr.length - 1 && n === 1 && numStr.length > 1) {
          result += 'เอ็ด';
        } else if (i === numStr.length - 2 && n === 2) {
          result += 'ยี่';
        } else if (i === numStr.length - 2 && n === 1) {
          result += '';
        } else {
          result += txtNumArr[n];
        }
        result += txtDigitArr[numStr.length - i - 1];
      }
    }
    return result;
  };

  bahtText += convert(baht) + 'บาท';
  if (satang === '00') {
    bahtText += 'ถ้วน';
  } else {
    bahtText += convert(satang) + 'สตางค์';
  }

  return bahtText;
}

module.exports = router;