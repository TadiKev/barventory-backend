// src/controllers/barController.js

import asyncHandler from 'express-async-handler';
import Bar from '../models/Bar.js';

// GET /api/bars
export const getBars = asyncHandler(async (req, res) => {
  const bars = await Bar.find().sort('name');
  res.json(bars);
});

// GET /api/bars/:id
export const getBarById = asyncHandler(async (req, res) => {
  const bar = await Bar.findById(req.params.id);
  if (!bar) {
    res.status(404);
    throw new Error('Bar not found');
  }
  res.json(bar);
});

// POST /api/bars
export const createBar = asyncHandler(async (req, res) => {
  const { name, location } = req.body;
  const bar = new Bar({ name, location });
  await bar.save();
  res.status(201).json(bar);
});

// PUT /api/bars/:id
export const updateBar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = (({ name, location }) => ({ name, location }))(req.body);
  const bar = await Bar.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true
  });
  if (!bar) {
    res.status(404);
    throw new Error('Bar not found');
  }
  res.json(bar);
});

// DELETE /api/bars/:id
export const deleteBar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const bar = await Bar.findByIdAndDelete(id);
  if (!bar) {
    res.status(404);
    throw new Error('Bar not found');
  }
  res.status(204).end();
});
