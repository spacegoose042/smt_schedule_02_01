import { Between, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { WorkOrder } from '../models/WorkOrder';
import { Line } from '../models/Line';
import { LineStatus } from '../models/Line';

interface SchedulingConstraints {
  maxFeederCapacity: number;
  minFeederCapacity: number;
  preferredLineId?: string;
  priority: number;
}

export class SchedulingService {
  private workOrderRepository = AppDataSource.getRepository(WorkOrder);
  private lineRepository = AppDataSource.getRepository(Line);

  // Get available lines for scheduling with constraints
  private async getAvailableLines(constraints: SchedulingConstraints): Promise<Line[]> {
    return this.lineRepository.find({
      where: {
        status: LineStatus.ACTIVE,
        isActive: true,
        feederCapacity: Between(constraints.minFeederCapacity, constraints.maxFeederCapacity)
      }
    });
  }

  // Calculate feeder capacity requirements for a work order
  private calculateFeederRequirements(workOrder: WorkOrder): { min: number; max: number } {
    // Base requirement is number of parts
    const baseRequirement = workOrder.numberOfParts;
    
    // Add 20% margin for double-sided boards
    const maxRequirement = workOrder.isDoubleSided 
      ? Math.ceil(baseRequirement * 1.2) 
      : baseRequirement;

    // Minimum requirement is 80% of max
    const minRequirement = Math.floor(maxRequirement * 0.8);

    return { min: minRequirement, max: maxRequirement };
  }

  // Calculate priority score for a work order (higher is more urgent)
  private calculatePriorityScore(workOrder: WorkOrder): number {
    const now = new Date();
    const dueDate = new Date(workOrder.dueDate);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    let score = 0;

    // Base priority from metadata (if set)
    score += (workOrder.metadata?.priority || 0) * 100;

    // Due date priority (exponential increase as due date approaches)
    if (daysUntilDue <= 0) {
      // Overdue orders get highest priority
      score += 1000;
    } else if (daysUntilDue <= 3) {
      // Orders due within 3 days get high priority
      score += 800;
    } else if (daysUntilDue <= 7) {
      // Orders due within a week get medium priority
      score += 500;
    }

    // Add priority for orders with all materials available
    if (workOrder.clearToBuild) {
      score += 200;
    }

    // Add priority for complex orders (need more setup time)
    if (workOrder.isDoubleSided) {
      score += 50;
    }
    if (workOrder.numberOfParts > 50) {
      score += 50;
    }

    return score;
  }

  // Check if a line has capacity for a work order
  private async hasLineCapacity(line: Line, workOrder: WorkOrder, startTime: Date): Promise<boolean> {
    // Check feeder capacity
    const requirements = this.calculateFeederRequirements(workOrder);
    if (line.feederCapacity < requirements.min) {
      return false;
    }

    // Check time slot availability
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
    // Calculate job times if not already set
    workOrder.calculateTotalJobTime();

    // Calculate feeder requirements
    const feederReqs = this.calculateFeederRequirements(workOrder);

    // Get scheduling constraints
    const constraints: SchedulingConstraints = {
      maxFeederCapacity: feederReqs.max,
      minFeederCapacity: feederReqs.min,
      preferredLineId: workOrder.lineId, // If already assigned to a line
      priority: this.calculatePriorityScore(workOrder)
    };

    // Get available lines that meet constraints
    const availableLines = await this.getAvailableLines(constraints);
    if (availableLines.length === 0) {
      throw new Error('No available lines meet the requirements for this work order');
    }

    let bestLine: Line | null = null;
    let earliestStartDate: Date | null = null;

    // Prioritize preferred line if specified
    if (constraints.preferredLineId) {
      const preferredLine = availableLines.find(l => l.id === constraints.preferredLineId);
      if (preferredLine) {
        const startDate = await this.findNextAvailableSlot(
          preferredLine,
          workOrder,
          new Date(Math.max(
            Date.now(),
            workOrder.materialAvailableDate.getTime()
          ))
        );
        bestLine = preferredLine;
        earliestStartDate = startDate;
      }
    }

    // If no preferred line or preferred line not available, find earliest slot on any line
    if (!bestLine || !earliestStartDate) {
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
      }
    });

    // Sort by priority score
    const prioritizedOrders = unscheduledOrders.sort((a, b) => 
      this.calculatePriorityScore(b) - this.calculatePriorityScore(a)
    );

    const scheduledOrders: WorkOrder[] = [];

    for (const order of prioritizedOrders) {
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