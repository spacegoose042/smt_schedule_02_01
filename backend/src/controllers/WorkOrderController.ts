import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { WorkOrder, MaterialStatus, WorkOrderPriority } from '../models/WorkOrder';
import { SchedulingService } from '../services/SchedulingService';
import { Between, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';

export class WorkOrderController {
  private workOrderRepository = AppDataSource.getRepository(WorkOrder);
  private schedulingService = new SchedulingService();

  // Create a new work order
  public createWorkOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const workOrder = this.workOrderRepository.create(req.body) as WorkOrder;
      
      // Calculate times
      workOrder.calculateTotalJobTime();
      
      // Update material status if material list is provided
      if (workOrder.materialList) {
        workOrder.updateMaterialStatus();
      }
      
      const savedWorkOrder = await this.workOrderRepository.save(workOrder);
      res.status(201).json(savedWorkOrder);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create work order', error });
    }
  };

  // Get all work orders
  public getAllWorkOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, priority, materialStatus } = req.query;
      
      const where: any = {};
      
      if (status === 'completed') {
        where.isCompleted = true;
      } else if (status === 'active') {
        where.isCompleted = false;
      }
      
      if (priority) {
        where.priority = In(Array.isArray(priority) ? priority : [priority]);
      }
      
      if (materialStatus) {
        where.materialStatus = In(Array.isArray(materialStatus) ? materialStatus : [materialStatus]);
      }

      const workOrders = await this.workOrderRepository.find({
        where,
        relations: ['line'],
        order: {
          priority: 'DESC',
          dueDate: 'ASC'
        }
      });
      res.json(workOrders);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch work orders', error });
    }
  };

  // Update material list
  public updateMaterialList = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { materialList } = req.body;
      
      const workOrder = await this.workOrderRepository.findOne({
        where: { id }
      });

      if (!workOrder) {
        res.status(404).json({ message: 'Work order not found' });
        return;
      }

      workOrder.materialList = materialList;
      workOrder.updateMaterialStatus();

      const updatedWorkOrder = await this.workOrderRepository.save(workOrder);
      res.json(updatedWorkOrder);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update material list', error });
    }
  };

  // Update material availability
  public updateMaterialAvailability = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { partNumber, available } = req.body;
      
      const workOrder = await this.workOrderRepository.findOne({
        where: { id }
      });

      if (!workOrder) {
        res.status(404).json({ message: 'Work order not found' });
        return;
      }

      if (!workOrder.materialList) {
        res.status(400).json({ message: 'Work order has no material list' });
        return;
      }

      const material = workOrder.materialList.find(m => m.partNumber === partNumber);
      if (!material) {
        res.status(404).json({ message: 'Part not found in material list' });
        return;
      }

      material.available = available;
      workOrder.updateMaterialStatus();

      const updatedWorkOrder = await this.workOrderRepository.save(workOrder);
      res.json(updatedWorkOrder);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update material availability', error });
    }
  };

  // Get work orders by date range
  public getWorkOrdersByDateRange = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        res.status(400).json({ message: 'Start date and end date are required' });
        return;
      }

      const workOrders = await this.workOrderRepository.find({
        where: {
          startDate: Between(new Date(startDate as string), new Date(endDate as string))
        },
        relations: ['line'],
        order: {
          startDate: 'ASC'
        }
      });

      res.json(workOrders);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch work orders', error });
    }
  };

  // Schedule a work order
  public scheduleWorkOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { lineId, startDate } = req.body;

      const workOrder = await this.workOrderRepository.findOne({
        where: { id },
        relations: ['line']
      });

      if (!workOrder) {
        res.status(404).json({ message: 'Work order not found' });
        return;
      }

      // For drag and drop, we'll allow scheduling even if not clear to build
      // This gives more flexibility to production planners
      try {
        const scheduledWorkOrder = await this.schedulingService.updateWorkOrderSchedule(
          workOrder,
          lineId,
          new Date(startDate)
        );
        res.json(scheduledWorkOrder);
      } catch (error) {
        if (error instanceof Error) {
          res.status(400).json({ message: error.message });
        } else {
          res.status(500).json({ message: 'Failed to schedule work order' });
        }
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to schedule work order', error });
    }
  };

  // Optimize schedule
  public optimizeSchedule = async (req: Request, res: Response): Promise<void> => {
    try {
      const scheduledOrders = await this.schedulingService.optimizeSchedule();
      res.json(scheduledOrders);
    } catch (error) {
      res.status(500).json({ message: 'Failed to optimize schedule', error });
    }
  };

  // Update work order
  public updateWorkOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const workOrder = await this.workOrderRepository.findOne({
        where: { id }
      });

      if (!workOrder) {
        res.status(404).json({ message: 'Work order not found' });
        return;
      }

      // Update the work order
      this.workOrderRepository.merge(workOrder, req.body);
      
      // Recalculate times if relevant fields were updated
      if (req.body.numberOfAssemblies || req.body.assemblyCycleTime || req.body.numberOfParts) {
        workOrder.calculateTotalJobTime();
      }

      // Update material status if material list was updated
      if (req.body.materialList) {
        workOrder.updateMaterialStatus();
      }

      const updatedWorkOrder = await this.workOrderRepository.save(workOrder);
      res.json(updatedWorkOrder);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update work order', error });
    }
  };

  // Delete work order
  public deleteWorkOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.workOrderRepository.delete(id);
      
      if (result.affected === 0) {
        res.status(404).json({ message: 'Work order not found' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete work order', error });
    }
  };

  // Toggle clear to build status
  public toggleClearToBuild = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const workOrder = await this.workOrderRepository.findOneBy({ id });

      if (!workOrder) {
        res.status(404).json({ message: 'Work order not found' });
        return;
      }

      workOrder.clearToBuild = !workOrder.clearToBuild;
      const updatedWorkOrder = await this.workOrderRepository.save(workOrder);
      res.json(updatedWorkOrder);
    } catch (error) {
      res.status(500).json({ message: 'Failed to toggle clear to build status', error });
    }
  };
} 