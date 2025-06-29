// routes/auth.js (Refactored for PostgreSQL + Aliases)
const express = require('express');
const router = express.Router();
// Use the PostgreSQL connection pool module
const db = require('../db/postgres');
// IMPORTANT: You need a library for password hashing! Install with: npm install bcrypt
// const bcrypt = require('bcrypt');

// Login using username and password
router.post('/login', async (req, res) => { // Use async handler
    const { username, password } = req.body;
    console.log(`Login attempt for username: ${username}`);

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        // Fetch user by username
        // IMPORTANT: Assumes 'password_hash' column. Alias other columns if needed (though id, username, role are often fine lowercase).
        const query = 'SELECT id, username, role, password_hash AS "passwordHash" FROM users WHERE username = $1'; // Alias added
        const result = await db.query(query, [username]);
        const user = result.rows[0];

        if (!user) {
            console.log(`Login attempt failed: User '${username}' not found.`);
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // --- COMPARE HASHED PASSWORD ---
        // Replace the insecure plain text check with hash comparison
        // const passwordMatch = await bcrypt.compare(password, user.passwordHash); // Use aliased passwordHash
        // if (!passwordMatch) {
        //     console.log(`Login attempt failed: Incorrect password for user '${username}'.`);
        //     return res.status(401).json({ message: 'Invalid username or password' });
        // }
        // --- END HASH COMPARISON ---

        // *** TEMPORARY INSECURE CHECK (REMOVE AND REPLACE WITH HASHING ABOVE!) ***
        if (!user.passwordHash || password !== user.passwordHash) { // Use aliased passwordHash
             console.warn(`Login attempt failed for user '${username}': Incorrect password (INSECURE plain text check). IMPLEMENT PASSWORD HASHING!`);
             return res.status(401).json({ message: 'Invalid username or password' });
        }
        console.warn(`WARN: User '${username}' logged in using INSECURE plain text password check. Implement bcrypt hashing.`);
        // *** END TEMPORARY INSECURE CHECK ***

        console.log(`Login successful for user '${username}' (ID: ${user.id})`);
        // Return user info (excluding password hash)
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                role: user.role
                // DO NOT send user.passwordHash back to client
            }
        });

    } catch (err) {
        console.error("Error during login:", err);
        res.status(500).json({ message: 'Server error during login' });
    }
});

module.exports = router;
