const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://phayayenice.com',
  ],
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'if-none-match',
  ],
  exposedHeaders: ['Content-Length', 'ETag'],
  maxAge: 3600
}));
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const logRoutes = require('./routes/logs');
//Report Management
const reportRoutes = require('./routes/reports');
//Expense Management
const expenseRoutes = require('./routes/expenses');
//Consumbable Inventory
const inventoryRoutes = require('./routes/inventory');
//Customer Management
const customerRoutes = require('./routes/customers');
//Container Management
const containerRoutes = require('./routes/containerRoutes');
//Sales Operations
const salesOperationsRoutes = require('./routes/salesOperations');
//Driver Management
const driverRoutes = require('./routes/drivers');

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/containers', containerRoutes);
app.use('/api/sales-ops', salesOperationsRoutes);
app.use('/api/drivers', driverRoutes);

const printBillRoute = require('./routes/printBill');
app.use('/print-bill', printBillRoute);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/test-headers', (req, res) => {
  const result = {
    message: "Header test endpoint",
    allHeaders: req.headers,
    authHeader: req.headers.authorization
  };
  console.log("HEADERS TEST:", result);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});