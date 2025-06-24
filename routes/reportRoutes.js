// src/routes/reportRoutes.js
import express from 'express';
import { getIncomeStatement, getBarPerformance } from '../controllers/reportController.js';

const router = express.Router();
router.get('/income-statement', getIncomeStatement);
router.get('/bar-performance',   getBarPerformance);

export default router;
