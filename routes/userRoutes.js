// backend/routes/userRoutes.js
import express              from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import { listUsers, createUser, updateUser, deleteUser } from '../controllers/userController.js';

const router = express.Router();

// all these routes protected → admin only
router.use(protect, requireAdmin);

router.get('/',   listUsers);
router.post('/',  createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
