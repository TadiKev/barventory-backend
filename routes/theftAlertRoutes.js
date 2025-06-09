// routes/theftAlertRoutes.js
import express from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import { listTheftAlerts } from '../controllers/theftAlertController.js';
const router = express.Router();

router
  .route('/')
  .get(protect, requireAdmin, listTheftAlerts);

export default router;
