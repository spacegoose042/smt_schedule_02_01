import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { WorkOrder } from '../models/WorkOrder';
import { Line, LineStatus } from '../models/Line';
import { Between } from 'typeorm';

export class DashboardController {
  private workOrderRepository = AppDataSource.getRepository(WorkOrder);
  private lineRepository = AppDataSource.getRepository(Line);

  public getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
      // Get work order stats
      const [workOrders, totalWorkOrders] = await this.workOrderRepository.findAndCount();
      const scheduledWorkOrders = workOrders.filter(wo => wo.startDate).length;
      const unscheduledWorkOrders = totalWorkOrders - scheduledWorkOrders;

      // Get line stats
      const [lines, totalLines] = await this.lineRepository.findAndCount();
      const activeLines = lines.filter(line => line.status === LineStatus.ACTIVE).length;

      // Get upcoming deadlines (next 7 days)
      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(now.getDate() + 7);

      const upcomingDeadlines = await this.workOrderRepository.find({
        where: {
          dueDate: Between(now, sevenDaysFromNow)
        },
        order: {
          dueDate: 'ASC'
        },
        take: 5
      });

      // Calculate line utilization (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);

      const lineUtilization = await Promise.all(
        lines.map(async (line) => {
          const workOrders = await this.workOrderRepository.find({
            where: {
              lineId: line.id,
              startDate: Between(thirtyDaysAgo, now)
            }
          });

          const totalHours = (now.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60);
          const totalJobTime = workOrders.reduce((acc, wo) => acc + (wo.totalJobTime / 60), 0);
          const utilization = Math.round((totalJobTime / totalHours) * 100);

          return {
            lineId: line.id,
            name: line.name,
            utilization
          };
        })
      );

      res.json({
        totalWorkOrders,
        scheduledWorkOrders,
        unscheduledWorkOrders,
        activeLines,
        totalLines,
        upcomingDeadlines: upcomingDeadlines.map(wo => ({
          id: wo.id,
          woId: wo.woId,
          dueDate: wo.dueDate,
          isLate: wo.dueDate < now
        })),
        lineUtilization
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard statistics', error });
    }
  };
} 