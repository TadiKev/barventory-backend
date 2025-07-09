// backend/controllers/userController.js
import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import mongoose from 'mongoose';

// @desc    List all users (admin only)
// @route   GET /api/users
// @access  Admin
export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().populate('bar','name').lean();
  res.json(users);
});

// @desc    Create a new user
// @route   POST /api/users
// @access  Admin
export const createUser = asyncHandler(async (req, res) => {
  const { username, password, role, bar } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (role === 'employee' && !mongoose.Types.ObjectId.isValid(bar)) {
    return res.status(400).json({ error: 'You must assign a bar to an employee' });
  }

  const exists = await User.findOne({ username });
  if (exists) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  const user = new User({
    username,
    password,
    role,
    // only set bar if employee
    bar: role === 'employee' ? bar : null
  });
  await user.save();

  res.status(201).json({
    _id:      user._id,
    username: user.username,
    role:     user.role,
    bar:      user.bar
  });
});

// @desc    Update existing user
// @route   PUT /api/users/:id
// @access  Admin
export const updateUser = asyncHandler(async (req, res) => {
  const { password, role, bar } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (password) user.password = password;
  if (role)     user.role     = role;
  // require bar for employees
  user.bar = role === 'employee'
    ? (mongoose.Types.ObjectId.isValid(bar) ? bar : user.bar)
    : null;

  await user.save();
  res.json({ _id: user._id, username: user.username, role: user.role, bar: user.bar });
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Admin
export const deleteUser = asyncHandler(async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.status(204).end();
});
