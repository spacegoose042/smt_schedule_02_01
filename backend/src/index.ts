import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { AppDataSource } from './config/database';
import workOrderRoutes from './routes/workOrderRoutes';
import lineRoutes from './routes/lineRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import { requireAuth, attachUserInfo } from './middleware/auth';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Auth middleware
app.use(requireAuth);
app.use(attachUserInfo);

// Routes
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/lines', lineRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('Data Source has been initialized!');

    // Start listening
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Error during Data Source initialization:', error);
    process.exit(1);
  }
};

startServer(); 