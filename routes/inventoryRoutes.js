import express from 'express';
import {
  getInventoryByBarAndDate,
  upsertInventory,
  bulkUpsertInventory,
} from '../controllers/inventoryController.js';

const router = express.Router();

router.get('/', getInventoryByBarAndDate);
router.post('/', upsertInventory);
router.post('/bulk-upsert', bulkUpsertInventory);  

export default router;
