import express from 'express';
import { getIncomeStatement } from '../controllers/reportController.js';

const router = express.Router();

// Other report endpoints…
router.get('/income-statement', getIncomeStatement);

export default router;
