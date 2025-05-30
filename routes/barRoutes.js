// src/routes/bars.js

import express from 'express';
import {
  getBars,
  createBar,
  updateBar,
  deleteBar
} from '../controllers/barController.js';

const router = express.Router();

router.get('/', getBars);
router.post('/', createBar);
router.put('/:id', updateBar);
router.delete('/:id', deleteBar);

export default router;
