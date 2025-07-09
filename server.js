// backend/server.js
import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';

import path             from 'path';
import { fileURLToPath } from 'url';

import connectDB        from './config/db.js';

// public routes
import authRoutes       from './routes/authRoutes.js';

// protected routes
import userRoutes       from './routes/userRoutes.js';
import barRoutes        from './routes/barRoutes.js';
import productRoutes    from './routes/productRoutes.js';
import inventoryRoutes  from './routes/inventoryRoutes.js';
import reportRoutes     from './routes/reportRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import expenseRoutes    from './routes/expenseRoutes.js';
import transferRoutes   from './routes/transferRoutes.js';
import dashboardRoutes  from './routes/dashboard.js';

import { protect }      from './middleware/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

async function startServer() {
  try {
    // 1) Connect to Mongo
    await connectDB();

    const app = express();
    app.use(cors());
    app.use(express.json());

    // 2) Public auth endpoints (login only, no open “register” if you prefer)
    app.use('/api/auth', authRoutes);

    // 3) Protected CRUD endpoints
    //    - /api/users     (admin creates employees)
    //    - /api/bars      (admin + employees)
    //    - /api/products
    //    - etc.
    app.use('/api/users',        protect, userRoutes);
    app.use('/api/bars',         protect, barRoutes);
    app.use('/api/products',     protect, productRoutes);
    app.use('/api/inventory',    protect, inventoryRoutes);
    app.use('/api/reports',      protect, reportRoutes);
    app.use('/api/transactions', protect, transactionRoutes);
    app.use('/api/expenses',     protect, expenseRoutes);
    app.use('/api/transfers',    protect, transferRoutes);
    app.use('/api/dashboard',    protect, dashboardRoutes);

    // 4) Serve React build
    const buildPath = path.join(__dirname, '..', 'build');
    app.use(express.static(buildPath));
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(buildPath, 'index.html'));
    });

    // 5) Global error handler
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ message: err.message });
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('❌ Server start failed:', err.message);
    process.exit(1);
  }
}

startServer();
