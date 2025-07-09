import express from 'express';
import { register, login } from '../controllers/authController.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// only admins can register new users
router.post('/register', protect, requireAdmin, register);
router.post('/login', login);

export default router;
