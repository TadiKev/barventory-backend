import express from 'express';
import {
  createTransfer,
  listTransfers,
  approveTransfer,
  rejectTransfer,
  deleteTransfer
} from '../controllers/transferController.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// any authenticated user can request a transfer
router.post('/', protect, createTransfer);

// only admin can view all, approve, reject, or delete
router.get('/',             protect, requireAdmin, listTransfers);
router.put('/:id/approve',  protect, requireAdmin, approveTransfer);
router.put('/:id/reject',   protect, requireAdmin, rejectTransfer);
router.delete('/:id',       protect, requireAdmin, deleteTransfer);

export default router;
