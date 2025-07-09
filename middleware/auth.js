import jwt           from 'jsonwebtoken';
import asyncHandler  from 'express-async-handler';
import User          from '../models/User.js';

export const protect = asyncHandler(async (req, res, next) => {
  let token = null;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
    try {
      const { userId } = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(userId).select('-password');
      if (!req.user) throw new Error();
      next();
    } catch {
      res.status(401).json({ error: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ error: 'Not authorized, no token' });
  }
});

export const requireAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Admin only' });
};
