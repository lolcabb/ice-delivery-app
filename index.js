const express = require('express');
//const bodyParser = require('body-parser');
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
app.use(express.json());

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

// --- Factory Operations ---
const vehicleRoutes = require('./routes/vehicles');
const tireRoutes = require('./routes/tires');
const waterRoutes = require('./routes/water');

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/logs', logRoutes);

// --- Expense Operations Routes ---
app.use('/api/reports', reportRoutes);
app.use('/api/expenses', expenseRoutes);

// --- Inventory Operations Routes ---
app.use('/api/inventory', inventoryRoutes);

// --- CRM Operations Routes ---
app.use('/api/customers', customerRoutes);
app.use('/api/containers', containerRoutes);

// --- Sales Operations Routes ---
app.use('/api/sales-ops', salesOperationsRoutes);
app.use('/api/drivers', driverRoutes);

// --- Factory Operations Routers ---
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/tires', tireRoutes);
app.use('/api/water', waterRoutes);

// Print Bill
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