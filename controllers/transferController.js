import asyncHandler from 'express-async-handler';
import { Types }    from 'mongoose';
import TransferRequest from '../models/TransferRequest.js';
import InventoryRecord from '../models/Inventory.js';

/**
 * POST /api/transfers
 * Create a pending transfer request.
 */
export const createTransfer = asyncHandler(async (req, res) => {
  const { productId, qty, fromBar, toBar } = req.body;
  const requestedBy = req.user._id;

  if (!productId || !qty || !fromBar || !toBar) {
    return res.status(400).json({ error: 'productId, qty, fromBar and toBar are required' });
  }
  if ([productId, fromBar, toBar].some(id => !Types.ObjectId.isValid(id))) {
    return res.status(400).json({ error: 'Invalid IDs' });
  }
  if (fromBar === toBar) {
    return res.status(400).json({ error: 'fromBar and toBar cannot be the same' });
  }

  const tr = await TransferRequest.create({
    product:     productId,
    qty,
    fromBar,
    toBar,
    requestedBy
  });

  const populated = await TransferRequest.findById(tr._id)
    .populate('product',     'name')
    .populate('fromBar',     'name')
    .populate('toBar',       'name')
    .populate('requestedBy', 'username');

  res.status(201).json(populated);
});

/**
 * GET /api/transfers?status=pending
 * List transfer requests by status.
 * (Admin only)
 */
export const listTransfers = asyncHandler(async (req, res) => {
  const status = req.query.status || 'pending';
  if (!['pending','approved','rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const list = await TransferRequest.find({ status })
    .sort({ createdAt: -1 })
    .populate('product',     'name')
    .populate('fromBar',     'name')
    .populate('toBar',       'name')
    .populate('requestedBy', 'username')
    .populate('approvedBy',  'username')
    .lean();

  res.json(list);
});

/**
 * PUT /api/transfers/:id/approve
 * Approve a pending transfer → update inventory for the given date.
 * (Admin only)
 */
export const approveTransfer = asyncHandler(async (req, res) => {
  const id   = req.params.id;
  const date = req.body.date; // must supply "YYYY-MM-DD"

  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid transfer ID' });
  }
  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  const tr = await TransferRequest.findById(id).lean();
  if (!tr) {
    return res.status(404).json({ error: 'Transfer not found' });
  }
  if (tr.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending transfers can be approved' });
  }

  // Mark as approved
  await TransferRequest.findByIdAndUpdate(id, {
    status:     'approved',
    approvedBy: req.user._id
  });

  // Parse date into UTC midnight
  const [Y, M, D]    = date.split('-').map(Number);
  const transferDate = new Date(Date.UTC(Y, M - 1, D, 0, 0, 0, 0));

  // Helper: get previous closing
  async function getPreviousClosing(barId, productId) {
    const prev = await InventoryRecord.find({
      bar:     barId,
      product: productId,
      date:    { $lt: transferDate }
    })
    .sort({ date: -1 })
    .limit(1)
    .lean();
    return prev.length ? prev[0].closing : 0;
  }

  // Helper: upsert and recalc inventory record
  async function apply(barId, incIn = 0, incOut = 0) {
    const opening = await getPreviousClosing(barId, tr.product);

    const rec = await InventoryRecord.findOneAndUpdate(
      { bar: barId, product: tr.product, date: transferDate },
      {
        $setOnInsert: {
          opening,
          receivedQty:   0,
          salesQty:      0,
          manualClosing: null
        },
        $inc: {
          transferInQty:  incIn,
          transferOutQty: incOut
        }
      },
      { upsert: true, new: true }
    ).lean();

    const o = rec.opening        || 0;
    const r = rec.receivedQty    || 0;
    const i = rec.transferInQty  || 0;
    const t = rec.transferOutQty || 0;
    const s = rec.salesQty       || 0;
    const m = rec.manualClosing != null ? rec.manualClosing : null;

    const expected = o + r + i - (s + t);
    const closing  = m != null ? m : expected;
    const variance = m != null ? m - expected : null;

    await InventoryRecord.updateOne(
      { _id: rec._id },
      { expectedClosing: expected, closing, variance }
    );
  }

  // Add to destination, subtract from source
  await apply(tr.toBar,   tr.qty, 0);
  await apply(tr.fromBar, 0,      tr.qty);

  const updated = await TransferRequest.findById(id)
    .populate('product',     'name')
    .populate('fromBar',     'name')
    .populate('toBar',       'name')
    .populate('requestedBy', 'username')
    .populate('approvedBy',  'username');

  res.json(updated);
});

/**
 * PUT /api/transfers/:id/reject
 * Reject a pending transfer.
 * (Admin only)
 */
export const rejectTransfer = asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid transfer ID' });
  }

  const tr = await TransferRequest.findById(id).lean();
  if (!tr) {
    return res.status(404).json({ error: 'Transfer not found' });
  }
  if (tr.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending transfers can be rejected' });
  }

  const updated = await TransferRequest.findByIdAndUpdate(
    id,
    { status: 'rejected', approvedBy: req.user._id },
    { new: true }
  )
    .populate('product',     'name')
    .populate('fromBar',     'name')
    .populate('toBar',       'name')
    .populate('requestedBy', 'username')
    .populate('approvedBy',  'username');

  res.json(updated);
});

/**
 * DELETE /api/transfers/:id
 * Delete any transfer (admin only).
 */
export const deleteTransfer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid transfer ID' });
  }

  const t = await TransferRequest.findByIdAndDelete(id).lean();
  if (!t) {
    return res.status(404).json({ error: 'Transfer not found' });
  }
  res.json({ message: 'Deleted', id });
});
