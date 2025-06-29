// routes/users.js (Refactored for PostgreSQL + Aliases)
const express = require('express');
const router = express.Router();
// Use the PostgreSQL connection pool module
const db = require('../db/postgres');
// Assuming authMiddleware works without modification for now
const { authMiddleware, requireRole } = require('../middleware/auth');
// IMPORTANT: You need a library for password hashing! Install with: npm install bcrypt
 const bcrypt = require('bcryptjs');
 const saltRounds = 12; // Example salt rounds for bcryptjs

// GET /api/users
router.get('/', authMiddleware, requireRole(['admin', 'manager']), async (req, res) => { // Use async handler
    console.log("Received GET /api/users request");
    try {
        // No aliases needed if id, username, role are lowercase in DB and frontend expects lowercase
        const sql = 'SELECT id, username, role FROM users';
        const result = await db.query(sql);
        const users = result.rows;
        console.log(`Fetched ${users.length} users.`);
        res.json(users);
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

// POST /api/users
router.post('/', authMiddleware, requireRole(['admin', 'manager']), async (req, res) => { // Use async handler
    const { username, password, role } = req.body;
    console.log("Received POST /api/users request for username:", username);

    // Input validation... (keep existing validation)
    if (!username || !password || !role) { return res.status(400).json({ message: 'Username, password, and role are required' }); }
    const allowedRoles = ['admin', 'manager', 'staff']; if (!allowedRoles.includes(role)) { return res.status(400).json({ message: 'Invalid role specified' }); }
    if (req.user.role === 'manager' && role === 'admin') { console.log(`Forbidden: Manager (ID: ${req.user.id}) attempted to create Admin.`); return res.status(403).json({ message: 'Managers cannot create Admins' }); }

    try {
        // --- HASH THE PASSWORD ---
         const passwordHash = await bcrypt.hash(password, saltRounds);
        // --- END HASHING ---

        // IMPORTANT: Store password_hash, not plain password! Use lowercase column names.
        const sql = 'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id';
        // Use the hashed password here:
        const params = [username, passwordHash, role];

        // *** TEMPORARY INSECURE INSERT (Replace with Hashing!) ***
        // const params = [username, password /* REPLACE THIS with passwordHash */, role];
        // console.warn(`WARN: Storing plain text password for user '${username}'. IMPLEMENT PASSWORD HASHING!`);
        // *** END TEMPORARY INSECURE INSERT ***

        const result = await db.query(sql, params);
        const newUserId = result.rows[0]?.id;
        if (!newUserId) { throw new Error("User creation failed, no ID returned."); }

        console.log(`User '${username}' created successfully with ID: ${newUserId}`);
        res.status(201).json({ message: 'User created', id: newUserId }); // Return lowercase id

    } catch (err) { // Error handling... (keep existing handling)
        if (err.code === '23505') { console.error(`Error creating user: Username '${username}' already exists.`); return res.status(409).json({ message: `Username '${username}' already exists` }); }
        console.error("Error creating user:", err);
        res.status(500).json({ message: 'Failed to create user' });
    }
});

// PUT /api/users/:id
router.put('/:id', authMiddleware, requireRole(['admin', 'manager']), async (req, res) => { // Use async handler
    const idStr = req.params.id;
    const { password, role } = req.body;
    console.log(`Received PUT /api/users/${idStr} request`);

    if (!/^\d+$/.test(idStr)) { return res.status(400).json({ message: 'Invalid user ID format' }); }
    const id = parseInt(idStr, 10);
    if (role !== undefined) { const allowedRoles = ['admin', 'manager', 'staff']; if (!allowedRoles.includes(role)) { return res.status(400).json({ message: 'Invalid role specified' }); } }

    try {
        // Get existing user details (lowercase role, aliased password_hash)
        const getSql = 'SELECT id, username, role, password_hash AS "passwordHash" FROM users WHERE id = $1'; // Alias added
        const getResult = await db.query(getSql, [id]);
        const existing = getResult.rows[0];
        if (!existing) { return res.status(404).json({ message: 'User not found' }); }

        // Permission checks (use lowercase role from existing user)
        if (req.user.role === 'manager' && existing.role === 'admin') { console.log(`Forbidden: Manager (ID: ${req.user.id}) attempted to modify Admin (ID: ${id}).`); return res.status(403).json({ message: 'Managers cannot modify Admins' }); }
        if (req.user.role === 'manager' && role === 'admin') { console.log(`Forbidden: Manager (ID: ${req.user.id}) attempted to promote user (ID: ${id}) to Admin.`); return res.status(403).json({ message: 'Managers cannot promote users to Admin' }); }

        // Prepare update query (use lowercase column names)
        const updates = []; const params = []; let paramIndex = 1;

        // --- HASH PASSWORD if provided ---
         if (password) {
           const passwordHash = await bcrypt.hash(password, saltRounds);
           updates.push(`password_hash = $${paramIndex++}`); // Update hash column
           params.push(passwordHash);
         }
        // --- END HASHING ---

        // *** TEMPORARY INSECURE UPDATE (Replace with Hashing!) ***
        // if (password) {
        //     updates.push(`password_hash = $${paramIndex++}`); // Assuming column name is password_hash
        //     params.push(password); // Storing plain text - BAD!
        //     console.warn(`WARN: Storing plain text password for user ID '${id}'. IMPLEMENT PASSWORD HASHING!`);
        // }
        // *** END TEMPORARY INSECURE UPDATE ***

        if (role !== undefined) { updates.push(`role = $${paramIndex++}`); params.push(role); }
        if (updates.length === 0) { return res.status(400).json({ message: 'No update fields provided (password or role)' }); }

        params.push(id); // Add ID for WHERE clause
        const updateSql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
        console.log("Executing user update:", updateSql, params.slice(0,-1)); // Don't log password/hash
        const updateResult = await db.query(updateSql, params);
        if (updateResult.rowCount === 0) { return res.status(404).json({ message: 'User not found during update' }); }

        console.log(`User ${id} updated successfully.`);
        res.json({ message: 'User updated' });

    } catch (err) { console.error(`Error updating user ${id}:`, err); res.status(500).json({ message: 'Failed to update user' }); }
});

// DELETE /api/users/:id
router.delete('/:id', authMiddleware, requireRole(['admin', 'manager']), async (req, res) => { // Use async handler
    const idStr = req.params.id;
    console.log(`Received DELETE /api/users/${idStr} request`);
    if (!/^\d+$/.test(idStr)) { return res.status(400).json({ message: 'Invalid user ID format' }); }
    const id = parseInt(idStr, 10);
    if (req.user && req.user.id === id) { console.log(`Forbidden: User (ID: ${id}) attempted to delete themselves.`); return res.status(403).json({ message: 'Users cannot delete themselves' }); }

    try {
        // Check user existence and role (lowercase role)
        const getSql = 'SELECT role FROM users WHERE id = $1';
        const getResult = await db.query(getSql, [id]);
        const existing = getResult.rows[0];
        if (!existing) { return res.status(404).json({ message: 'User not found' }); }

        // Permission check (use lowercase role)
        if (req.user.role === 'manager' && existing.role === 'admin') { console.log(`Forbidden: Manager (ID: ${req.user.id}) attempted to delete Admin (ID: ${id}).`); return res.status(403).json({ message: 'Managers cannot delete Admins' }); }

        // Execute delete
        const deleteSql = 'DELETE FROM users WHERE id = $1';
        const deleteResult = await db.query(deleteSql, [id]);
        if (deleteResult.rowCount === 0) { console.error(`Failed to delete user ${id} even though user was found initially.`); return res.status(404).json({ message: 'User not found during delete operation' }); }

        console.log(`User ${id} deleted successfully.`);
        res.json({ message: 'User deleted' });

    } catch (err) { console.error(`Error deleting user ${id}:`, err); res.status(500).json({ message: 'Failed to delete user' }); }
});

module.exports = router;
