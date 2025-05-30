// backend/controllers/authController.js
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/User.js';

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

// @desc Register
// @route POST /api/auth/register
// @access Public
export const register = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Required' });

  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ message: 'Username taken' });

  const user = await User.create({ username, password });
  res.status(201).json({
    user: { id: user._id, username: user.username },
    token: generateToken(user._id),
  });
});

// @desc Login
// @route POST /api/auth/login
// @access Public
export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && await user.comparePassword(password)) {
    return res.json({
      user: { id: user._id, username: user.username },
      token: generateToken(user._id),
    });
  }
  res.status(401).json({ message: 'Invalid credentials' });
});
