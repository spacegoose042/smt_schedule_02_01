import { Router } from 'express';
import { LineController } from '../controllers/LineController';
import { requireAuth, requireRole } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();
const lineController = new LineController();

// Apply authentication middleware to all routes
router.use(requireAuth);

// GET routes
router.get('/', lineController.getAllLines);
router.get('/:id', lineController.getLineById);
router.get('/:id/utilization', lineController.getLineUtilization);

// POST routes - require admin or scheduler role
router.post('/', requireRole([UserRole.ADMIN]), lineController.createLine);

// PUT routes - require admin or scheduler role
router.put('/:id', requireRole([UserRole.ADMIN, UserRole.SCHEDULER]), lineController.updateLine);
router.put('/:id/status', requireRole([UserRole.ADMIN, UserRole.SCHEDULER]), lineController.updateLineStatus);

// DELETE routes - require admin role
router.delete('/:id', requireRole([UserRole.ADMIN]), lineController.deleteLine);

export default router; 