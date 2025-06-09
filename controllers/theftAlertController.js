// controllers/theftAlertController.js
import asyncHandler from 'express-async-handler';
import TheftAlert from '../models/TheftAlert.js';

export const listTheftAlerts = asyncHandler(async (req, res) => {
  const { barId, date } = req.query;
  const filter = {};
  if (barId) filter.bar = barId;
  if (date) {
    const d = new Date(date);
    d.setUTCHours(0,0,0,0);
    filter.date = d;
  }
  const alerts = await TheftAlert.find(filter)
    .populate('inventoryRecord', 'product date')
    .populate('flaggedBy', 'username')
    .sort({ createdAt: -1 });

  res.json(alerts);
});
