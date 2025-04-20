// scripts/add-status-updated-at.js
const db = require('../db/database'); // adjust path if needed

// Run the migration
db.prepare(`ALTER TABLE orders ADD COLUMN statusUpdatedAt TEXT;`).run();
db.prepare(`
  UPDATE orders
    SET statusUpdatedAt = createdAt
    WHERE statusUpdatedAt IS NULL;
`).run();

console.log('Migration complete: statusUpdatedAt added and back‑filled.');
