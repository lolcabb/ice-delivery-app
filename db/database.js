const Database = require('better-sqlite3');
const db = new Database('ice.db');

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customerName TEXT,
    address TEXT,
    phone TEXT,
    driverName TEXT,
    status TEXT DEFAULT 'Created',
	issuer TEXT,
    createdAt TEXT,
	statusUpdatedAt TEXT,
	paymentType TEXT
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER,
    productType TEXT,
    quantity INTEGER,
    pricePerUnit REAL,
    totalAmount REAL,
    FOREIGN KEY (orderId) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    userId INTEGER,
    action TEXT,
    orderId INTEGER,
    field TEXT,
    oldValue TEXT,
    newValue TEXT
  );
`);

// Seed admin user
const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
if (userCount === 0) {
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
    .run('testadmin', 'admin123', 'admin');
  console.log('✅ Admin user seeded: testadmin / admin123');
}

module.exports = db;