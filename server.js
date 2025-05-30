// backend/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import barRoutes from './routes/barRoutes.js';
import productRoutes from './routes/productRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';

dotenv.config();

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());

    // API routes
    app.use('/api/auth', authRoutes);
    app.use('/api/bars', barRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/inventory', inventoryRoutes);
    app.use('/api/reports', reportRoutes);
    app.use('/api/transactions', transactionRoutes);
    app.use('/api/expenses', expenseRoutes);

    // 1) Serve static files from the React app build folder
    const buildPath = path.join(process.cwd(), 'build');
    app.use(express.static(buildPath));

    // 2) Catch-all for non-API routes: send back React's index.html
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(buildPath, 'index.html'));
    });

    // Error handler (must come after all routes)
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ message: err.message });
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(` Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error(' Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
