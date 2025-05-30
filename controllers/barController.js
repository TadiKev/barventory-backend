// src/controllers/barsController.js

import Bar from '../models/Bar.js';

// GET /api/bars
export const getBars = async (req, res, next) => {
  try {
    const bars = await Bar.find().sort('name');
    res.json(bars);
  } catch (err) {
    next(err);
  }
};

// POST /api/bars
export const createBar = async (req, res, next) => {
  try {
    const { name, location } = req.body;
    const bar = new Bar({ name, location });
    await bar.save();
    res.status(201).json(bar);
  } catch (err) {
    next(err);
  }
};

// PUT /api/bars/:id
export const updateBar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = (({ name, location }) => ({ name, location }))(req.body);
    const bar = await Bar.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });
    if (!bar) {
      return res.status(404).json({ message: 'Bar not found' });
    }
    res.json(bar);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/bars/:id
export const deleteBar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const bar = await Bar.findByIdAndDelete(id);
    if (!bar) {
      return res.status(404).json({ message: 'Bar not found' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
