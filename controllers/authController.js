// backend/controllers/authController.js

import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/User.js';

// Generate a JWT whose payload contains { userId }
const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req, res) => {
  const { username, password, role } = req.body;
  // default to 'employee' if no role provided
  const newRole = role || 'employee';

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const exists = await User.findOne({ username });
  if (exists) {
    return res.status(400).json({ message: 'Username already taken' });
  }

  // create user with specified (or default) role
  const user = await User.create({ username, password, role: newRole });

  res.status(201).json({
    user: {
      id:       user._id,
      username: user.username,
      role:     user.role,
    },
    token: generateToken(user._id),
  });
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (user && await user.comparePassword(password)) {
    return res.json({
      user: {
        id:       user._id,
        username: user.username,
        role:     user.role,
      },
      token: generateToken(user._id),
    });
  }

  res.status(401).json({ message: 'Invalid credentials' });
});
