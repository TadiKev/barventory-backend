// backend/controllers/authController.js

import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Bar from '../models/Bar.js';

const { ObjectId } = mongoose.Types;

// Generate a JWT whose payload contains { userId }
const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Admin only (protect this route with requireAdmin middleware)
export const register = asyncHandler(async (req, res) => {
  const { username, password, role = 'employee', barId } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  // If employee, barId must be provided and valid
  if (role === 'employee') {
    if (!barId || !ObjectId.isValid(barId)) {
      return res.status(400).json({ message: 'Employee must be assigned a valid barId' });
    }
    // ensure that bar exists
    const barExists = await Bar.exists({ _id: barId });
    if (!barExists) {
      return res.status(400).json({ message: 'Assigned bar does not exist' });
    }
  }

  // prevent duplicate usernames
  const exists = await User.findOne({ username });
  if (exists) {
    return res.status(400).json({ message: 'Username already taken' });
  }

  // create the user, assigning the bar only if employee
  const user = await User.create({
    username,
    password,
    role,
    ...(role === 'employee' ? { bar: barId } : {})
  });

  // populate the bar field for response
  await user.populate('bar', 'name').execPopulate();

  res.status(201).json({
    user: {
      id:       user._id,
      username: user.username,
      role:     user.role,
      bar:      user.bar
        ? { id: user.bar._id, name: user.bar.name }
        : null
    },
    token: generateToken(user._id),
  });
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // fetch user plus their assigned bar (if any)
  const user = await User.findOne({ username }).populate('bar', 'name');

  if (user && await user.comparePassword(password)) {
    return res.json({
      user: {
        id:       user._id,
        username: user.username,
        role:     user.role,
        bar:      user.bar
          ? { id: user.bar._id, name: user.bar.name }
          : null
      },
      token: generateToken(user._id),
    });
  }

  res.status(401).json({ message: 'Invalid credentials' });
});
