// middleware/auth.js
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/User.js'; // adjust path if your User model lives somewhere else

/**
 * Middleware: protect
 *   Verifies JWT from Authorization header (Bearer <token>),
 *   loads the user into req.user if valid, otherwise returns 401.
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token = null;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      // Replace “your_jwt_secret” with whatever you use in process.env.JWT_SECRET
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Load user from DB (excluding password)
      req.user = await User.findById(decoded.userId).select('-password');
      if (!req.user) {
        res.status(401);
        throw new Error('User not found from token');
      }
      next();
    } catch (err) {
      console.error('Auth middleware error:', err.message);
      res.status(401).json({ error: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ error: 'Not authorized, no token provided' });
  }
});

/**
 * Middleware: requireAdmin
 *   Checks that req.user exists and has role === 'admin'.
 *   If not, returns 403 Forbidden.
 */
export const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: requires admin role' });
  }
};
