import express from 'express';
import {
  getInventoryByBarAndDate,
  upsertInventory,
  bulkUpsertInventory,
} from '../controllers/inventoryController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// If you want /GET protected too, include `protect` there as well:
router.get('/', protect, getInventoryByBarAndDate);

// Both upsert and bulk‑upsert must be protected:
router.post('/', protect, upsertInventory);
router.post('/bulk-upsert', protect, bulkUpsertInventory);

export default router;
