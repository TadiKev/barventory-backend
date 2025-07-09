// src/routes/barRoutes.js

import express from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import {
  getBars,
  getBarById,
  createBar,
  updateBar,
  deleteBar
} from '../controllers/barController.js';

const router = express.Router();

// All routes under /api/bars are protected
router.use(protect);

// Admins may see/create/update/delete any bar
router
  .route('/')
  .get(getBars)
  .post(requireAdmin, createBar);

router
  .route('/:id')
  .get(getBarById)
  .put(requireAdmin, updateBar)
  .delete(requireAdmin, deleteBar);

export default router;
