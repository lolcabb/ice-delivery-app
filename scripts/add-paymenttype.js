// scripts/add-status-updated-at.js
const db = require('../db/database'); // adjust path if needed

// Run the migration
db.prepare(`ALTER TABLE orders ADD COLUMN paymentType TEXT;`).run();

console.log('Migration complete: paymentType');
