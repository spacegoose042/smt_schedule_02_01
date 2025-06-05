import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { requireAuth } from '../middleware/auth';

const router = Router();
const dashboardController = new DashboardController();

// Apply authentication middleware
router.use(requireAuth);

// Dashboard routes
router.get('/stats', dashboardController.getDashboardStats);

export default router; 