import { Router } from 'express';
import { WorkOrderController } from '../controllers/WorkOrderController';
import { requireAuth } from '../middleware/auth';

const router = Router();
const workOrderController = new WorkOrderController();

// Apply authentication middleware to all routes
router.use(requireAuth);

// GET routes
router.get('/', workOrderController.getAllWorkOrders);
router.get('/date-range', workOrderController.getWorkOrdersByDateRange);

// POST routes
router.post('/', workOrderController.createWorkOrder);
router.post('/:id/schedule', workOrderController.scheduleWorkOrder);
router.post('/optimize', workOrderController.optimizeSchedule);

// PUT routes
router.put('/:id', workOrderController.updateWorkOrder);

// DELETE routes
router.delete('/:id', workOrderController.deleteWorkOrder);

export default router; 