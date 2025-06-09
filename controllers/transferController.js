// controllers/transferController.js

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
    .populate('product','name')
    .populate('fromBar','name')
    .populate('toBar','name')
    .populate('requestedBy','username');

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
    .populate('product','name')
    .populate('fromBar','name')
    .populate('toBar','name')
    .populate('requestedBy','username')
    .populate('approvedBy','username')
    .lean();

  res.json(list);
});

/**
 * PUT /api/transfers/:id/approve
 * Approve a pending transfer → update inventory.
 * (Admin only)
 */
export const approveTransfer = asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid transfer ID' });
  }
  const tr = await TransferRequest.findById(id).lean();
  if (!tr) return res.status(404).json({ error: 'Not found' });
  if (tr.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending can be approved' });
  }

  // 1) Mark as approved
  await TransferRequest.findByIdAndUpdate(id, {
    status:     'approved',
    approvedBy: req.user._id
  });

  // 2) Compute "today at midnight UTC"
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  // Helper to upsert & recalc one InventoryRecord
  async function apply(barId, incIn = 0, incOut = 0) {
    // upsert the record for "now"
    const rec = await InventoryRecord.findOneAndUpdate(
      {
        bar:     barId,
        product: tr.product,
        date:    now
      },
      {
        $inc: { transferInQty: incIn, transferOutQty: incOut }
      },
      { upsert: true, new: true }
    ).lean();

    // Recompute all derived fields
    const opening       = rec.opening       || 0;
    const receivedQty   = rec.receivedQty   || 0;
    const transferInQty = rec.transferInQty || 0;
    const salesQty      = rec.salesQty      || 0;
    const transferOutQty= rec.transferOutQty|| 0;
    const manualClosing = rec.manualClosing != null ? rec.manualClosing : null;

    const expectedClosing = opening + receivedQty + transferInQty - (salesQty + transferOutQty);
    const closing         = manualClosing != null ? manualClosing : expectedClosing;
    const variance        = manualClosing != null ? manualClosing - expectedClosing : null;

    await InventoryRecord.updateOne(
      { _id: rec._id },
      { expectedClosing, closing, variance }
    );
  }

  // 3a) Add stock to the "toBar"
  await apply(tr.toBar, tr.qty, 0);

  // 3b) Subtract stock from the "fromBar"
  await apply(tr.fromBar, 0, tr.qty);

  // 4) Return the newly approved TransferRequest
  const updated = await TransferRequest.findById(id)
    .populate('product','name')
    .populate('fromBar','name')
    .populate('toBar','name')
    .populate('requestedBy','username')
    .populate('approvedBy','username');

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
  if (!tr) return res.status(404).json({ error: 'Not found' });
  if (tr.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending can be rejected' });
  }

  const updated = await TransferRequest.findByIdAndUpdate(
    id,
    { status: 'rejected', approvedBy: req.user._id },
    { new: true }
  )
    .populate('product','name')
    .populate('fromBar','name')
    .populate('toBar','name')
    .populate('requestedBy','username')
    .populate('approvedBy','username');

  res.json(updated);
});
