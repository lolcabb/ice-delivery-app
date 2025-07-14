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

// --- Aggregated Routes ---
const routes = require('./routes');

// --- Auth & User Routes ---
app.use('/api/auth', routes.authRoutes);
app.use('/api/users', routes.userRoutes);

// --- CRM Routes ---
app.use('/api/customers', routes.customerRoutes);
app.use('/api/containers', routes.containerRoutes);

// --- Sales Operations Routes ---
app.use('/api/orders', routes.orderRoutes);
app.use('/api/sales-ops', routes.salesOperationsRoutes);
app.use('/api/drivers', routes.driverRoutes);
app.use('/api/logs', routes.logRoutes);

// --- Inventory, Expenses & Reports Routes ---
app.use('/api/inventory', routes.inventoryRoutes);
app.use('/api/expenses', routes.expenseRoutes);
app.use('/api/reports', routes.reportRoutes);

// --- Factory Operations Routes ---
app.use('/api/vehicles', routes.vehicleRoutes);
app.use('/api/tires', routes.tireRoutes);
app.use('/api/water', routes.waterRoutes);

// --- Misc ---
app.use('/print-bill', routes.printBillRoute);

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