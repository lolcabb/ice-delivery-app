// Route handler using Express + ExcelJS
const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../db/database');
const path = require('path');
const fs = require('fs');

const router = express.Router();

router.get('/print-sheet/:orderId', async (req, res) => {
  const orderId = req.params.orderId;

  // Get order and items
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const items = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(orderId);

  if (!order || items.length === 0) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  const productMap = {
    'Product A': { name: 'Product A', quantity: 0, price: 0 },
    'Product B': { name: 'Product B', quantity: 0, price: 0 },
    'Product C': { name: 'Product C', quantity: 0, price: 0 },
    'Product D': { name: 'Product D', quantity: 0, price: 0 },
    'Product E': { name: 'Product E', quantity: 0, price: 0 }
  };

  items.forEach(item => {
    if (productMap[item.productType]) {
      productMap[item.productType].quantity = item.quantity;
      productMap[item.productType].price = item.pricePerUnit;
    }
  });

  try {
    const templatePath = path.join(__dirname, '../templates/bill reference.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const sheet = workbook.getWorksheet('Sheet1');

    // Inject values
    sheet.getCell('I1').value = order.id;
    sheet.getCell('B5').value = order.customerName;

    const createdDate = new Date(order.createdAt);
    sheet.getCell('G4').value = createdDate.toLocaleDateString('th-TH');
    sheet.getCell('H4').value = createdDate.toLocaleTimeString();

    // Products
    const rows = ['9', '11', '13', '15', '17'];
    const keys = Object.keys(productMap);
    keys.forEach((product, i) => {
      const row = rows[i];
      const p = productMap[product];
      sheet.getCell(`B${row}`).value = p.name;
      sheet.getCell(`F${row}`).value = p.quantity;
      sheet.getCell(`G${row}`).value = p.price;
    });

    // Driver and issuer
    sheet.getCell('E20').value = order.driverName || '……………';
    sheet.getCell('F20').value = order.issuer || '……………';

    // Stream result
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=order-${order.id}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error generating Excel file.' });
  }
});

module.exports = router;
