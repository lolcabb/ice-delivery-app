// 📁 routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/postgres');
const router = express.Router();

// Import JWT_SECRET from config
const { JWT_SECRET } = require('../config');

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Input validation
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    console.log('Login attempt for user:', username);
    
    // Find user in database
    const userResult = await db.query('SELECT id, username, role, password_hash FROM users WHERE username = $1', [username]);
    const user = userResult.rows[0];
    
    // Check if user exists
    if (!user) {
      console.log('Login failed: User not found');
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      console.log('Login failed: Invalid password');
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // Create token - ENSURE id field is correctly set!
    const tokenPayload = {
      id: user.id, // Make sure this is the correct property name expected by auth middleware
      username: user.username,
      role: user.role
    };
    
    console.log('Creating token with payload:', tokenPayload);
    
    const token = jwt.sign(
      tokenPayload, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    console.log('Login successful for user:', username);
    
    // Return token and user info
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

module.exports = router;