// Unified authentication middleware
const jwt = require('jsonwebtoken');
const db = require('../db/postgres');
const { JWT_SECRET } = require('../config');

/**
 * Authentication middleware to verify the JWT token
 */
const authMiddleware = async (req, res, next) => {
  // Debug information
  console.log('=== AUTH DEBUG ===');
  console.log('Request path:', req.path);
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Auth header missing or malformed:', authHeader);
    return res.status(401).json({ message: 'Access denied. Authorization header missing or malformed.' });
  }

  const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"

  if (!token) {
    console.log('No token extracted from header');
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Log decoded token payload (useful for debugging)
    console.log('Decoded token payload:', JSON.stringify(decoded));
    console.log('User ID in token:', decoded.id);
    console.log('Type of ID:', typeof decoded.id);
    
    // Check for token structure
    if (!decoded || typeof decoded !== 'object') {
      return res.status(401).json({ message: 'Invalid token format: Not an object' });
    }
    
    if (decoded.id === undefined) {
      console.error('JWT decode error: Missing ID in token payload', decoded);
      
      // Try to find alternative ID fields
      const possibleIdKeys = Object.keys(decoded).filter(
        key => key.toLowerCase().includes('id')
      );
      
      if (possibleIdKeys.length > 0) {
        console.log('Possible ID fields:', possibleIdKeys);
        // Use the first possible ID field
        decoded.id = decoded[possibleIdKeys[0]];
        console.log('Using alternative ID field:', possibleIdKeys[0], 'Value:', decoded.id);
      } else {
        return res.status(401).json({ message: 'Invalid token structure: No ID found' });
      }
    }
    
    // Ensure ID is properly formatted for database query
    const userId = typeof decoded.id === 'string' ? parseInt(decoded.id, 10) : decoded.id;
    
    // Find user in database to ensure they still exist and have proper permissions
    console.log('Querying database for user ID:', userId);
    const result = await db.query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    
    if (!user) {
      console.log('User not found in database');
      return res.status(401).json({ message: 'Authentication failed: User not found' });
    }
    
    console.log('User found:', user.username, 'Role:', user.role);
    
    // Attach user to request object
    req.user = user;
    next();
  } catch (err) {
    // Handle specific JWT errors with descriptive messages
    if (err.name === 'TokenExpiredError') {
      console.log('Token expired at:', err.expiredAt);
      return res.status(401).json({ message: 'Token expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      console.log('JWT error:', err.message);
      return res.status(401).json({ message: 'Invalid token. Please log in again.' });
    }
    
    console.error('Auth middleware error:', err);
    return res.status(401).json({ message: 'Authentication failed: ' + err.message });
  }
};

/**
 * Role-based authorization middleware
 * @param {Array} allowedRoles - Array of roles that are allowed to access the endpoint
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authorization failed: User not authenticated' });
    }
    
    // Normalize roles for case-insensitive comparison
    const userRole = req.user.role.toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map(role => role.toLowerCase());
    
    if (!normalizedAllowedRoles.includes(userRole)) {
      console.log(`Access denied: User ${req.user.id} (${req.user.role}) attempted to access resource restricted to ${allowedRoles.join(', ')}`);
      return res.status(403).json({ message: 'Forbidden: Insufficient rights' });
    }
    
    next();
  };
};

// Export both the middleware and the JWT_SECRET to ensure consistent use
module.exports = { authMiddleware, requireRole };