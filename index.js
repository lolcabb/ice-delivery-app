const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const logRoutes = require('./routes/logs');
const reportRoutes = require('./routes/reports');

app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/reports', reportRoutes);

const printSheetRoute = require('./routes/generate-excel-bill');
app.use('/api', printSheetRoute);

const printBillRoute = require('./routes/printBill');
app.use('/print-bill', printBillRoute);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.listen(PORT, () => {
  console.log('🚀 Server running on ${PORT}');
});