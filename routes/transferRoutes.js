import express from 'express';
import {
  createTransfer,
  listTransfers,
  approveTransfer,
  rejectTransfer
} from '../controllers/transferController.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// any authenticated user can request
router.post('/', protect, createTransfer);

// only admin can list, approve, reject
router.get('/',  protect, requireAdmin, listTransfers);
router.put('/:id/approve', protect, requireAdmin, approveTransfer);
router.put('/:id/reject',  protect, requireAdmin, rejectTransfer);

export default router;
