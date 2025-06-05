import { Between, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { WorkOrder } from '../models/WorkOrder';
import { Line } from '../models/Line';
import { LineStatus } from '../models/Line';

export class SchedulingService {
  private workOrderRepository = AppDataSource.getRepository(WorkOrder);
  private lineRepository = AppDataSource.getRepository(Line);

  // Get available lines for scheduling
  private async getAvailableLines(): Promise<Line[]> {
    return this.lineRepository.find({
      where: {
        status: LineStatus.ACTIVE,
        isActive: true
      }
    });
  }

  // Check if a line has capacity for a work order
  private async hasLineCapacity(line: Line, workOrder: WorkOrder, startTime: Date): Promise<boolean> {
    const existingOrders = await this.workOrderRepository.find({
      where: {
        lineId: line.id,
        startDate: Between(startTime, new Date(startTime.getTime() + workOrder.totalJobTime * 60 * 1000))
      }
    });

    return existingOrders.length === 0;
  }

  // Find the next available time slot for a work order on a given line
  private async findNextAvailableSlot(line: Line, workOrder: WorkOrder, afterTime: Date): Promise<Date> {
    const existingOrders = await this.workOrderRepository.find({
      where: {
        lineId: line.id,
        startDate: MoreThanOrEqual(afterTime)
      },
      order: {
        startDate: 'ASC'
      }
    });

    let candidateTime = new Date(afterTime);

    // Adjust to start of next working day if outside working hours
    candidateTime = this.adjustToWorkingHours(candidateTime);

    for (const order of existingOrders) {
      if (await this.hasLineCapacity(line, workOrder, candidateTime)) {
        return candidateTime;
      }
      if (order.startDate) {
        candidateTime = new Date(order.startDate.getTime() + order.totalJobTime * 60 * 1000);
        candidateTime = this.adjustToWorkingHours(candidateTime);
      }
    }

    return candidateTime;
  }

  // Adjust time to working hours (7:30 AM - 4:30 PM, Mon-Fri)
  private adjustToWorkingHours(date: Date): Date {
    const adjustedDate = new Date(date);
    
    // Set to local timezone
    const hours = adjustedDate.getHours();
    const minutes = adjustedDate.getMinutes();
    const dayOfWeek = adjustedDate.getDay();

    // If weekend, move to Monday
    if (dayOfWeek === 0) { // Sunday
      adjustedDate.setDate(adjustedDate.getDate() + 1);
      adjustedDate.setHours(7, 30, 0, 0);
    } else if (dayOfWeek === 6) { // Saturday
      adjustedDate.setDate(adjustedDate.getDate() + 2);
      adjustedDate.setHours(7, 30, 0, 0);
    }

    // If before 7:30 AM, set to 7:30 AM
    if (hours < 7 || (hours === 7 && minutes < 30)) {
      adjustedDate.setHours(7, 30, 0, 0);
    }
    // If after 4:30 PM, set to 7:30 AM next day
    else if (hours > 16 || (hours === 16 && minutes > 30)) {
      adjustedDate.setDate(adjustedDate.getDate() + 1);
      adjustedDate.setHours(7, 30, 0, 0);
      return this.adjustToWorkingHours(adjustedDate); // Recursive call to handle weekends
    }

    return adjustedDate;
  }

  // Schedule a single work order
  public async scheduleWorkOrder(workOrder: WorkOrder): Promise<WorkOrder> {
    const availableLines = await this.getAvailableLines();
    if (availableLines.length === 0) {
      throw new Error('No available lines for scheduling');
    }

    let bestLine: Line | null = null;
    let earliestStartDate: Date | null = null;

    // Calculate job times if not already set
    workOrder.calculateTotalJobTime();

    // Find the earliest available slot across all lines
    for (const line of availableLines) {
      const startDate = await this.findNextAvailableSlot(
        line,
        workOrder,
        new Date(Math.max(
          Date.now(),
          workOrder.materialAvailableDate.getTime()
        ))
      );

      if (!earliestStartDate || startDate < earliestStartDate) {
        earliestStartDate = startDate;
        bestLine = line;
      }
    }

    if (!bestLine || !earliestStartDate) {
      throw new Error('Could not find suitable scheduling slot');
    }

    // Update work order with scheduling information
    workOrder.line = bestLine;
    workOrder.lineId = bestLine.id;
    workOrder.startDate = earliestStartDate;

    // Save the scheduled work order
    return this.workOrderRepository.save(workOrder);
  }

  // Optimize schedule for all unscheduled work orders
  public async optimizeSchedule(): Promise<WorkOrder[]> {
    const unscheduledOrders = await this.workOrderRepository.find({
      where: {
        startDate: IsNull(),
        clearToBuild: true
      },
      order: {
        dueDate: 'ASC' // Priority to earlier due dates
      }
    });

    const scheduledOrders: WorkOrder[] = [];

    for (const order of unscheduledOrders) {
      try {
        const scheduledOrder = await this.scheduleWorkOrder(order);
        scheduledOrders.push(scheduledOrder);
      } catch (error) {
        console.error(`Failed to schedule work order ${order.woId}:`, error);
      }
    }

    return scheduledOrders;
  }
} 