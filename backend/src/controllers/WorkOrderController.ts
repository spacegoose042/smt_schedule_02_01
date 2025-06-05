import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { WorkOrder } from '../models/WorkOrder';
import { SchedulingService } from '../services/SchedulingService';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

export class WorkOrderController {
  private workOrderRepository = AppDataSource.getRepository(WorkOrder);
  private schedulingService = new SchedulingService();

  // Create a new work order
  public createWorkOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const workOrder = this.workOrderRepository.create(req.body) as WorkOrder;
      
      // Calculate times
      workOrder.calculateTotalJobTime();
      
      const savedWorkOrder = await this.workOrderRepository.save(workOrder);
      res.status(201).json(savedWorkOrder);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create work order', error });
    }
  };

  // Get all work orders
  public getAllWorkOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const workOrders = await this.workOrderRepository.find({
        relations: ['line']
      });
      res.json(workOrders);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch work orders', error });
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
      const workOrder = await this.workOrderRepository.findOne({
        where: { id },
        relations: ['line']
      });

      if (!workOrder) {
        res.status(404).json({ message: 'Work order not found' });
        return;
      }

      if (!workOrder.clearToBuild) {
        res.status(400).json({ message: 'Work order is not clear to build' });
        return;
      }

      const scheduledWorkOrder = await this.schedulingService.scheduleWorkOrder(workOrder);
      res.json(scheduledWorkOrder);
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
} 