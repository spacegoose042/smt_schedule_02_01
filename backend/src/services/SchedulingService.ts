import { Between, LessThanOrEqual, MoreThanOrEqual, IsNull, Not } from 'typeorm';
import { AppDataSource } from '../config/database';
import { WorkOrder } from '../models/WorkOrder';
import { Line } from '../models/Line';
import { LineStatus } from '../models/Line';

interface SchedulingConstraints {
  trolleysRequired: number;
  preferredLineId?: string;
  priority: number;
}

const TOTAL_TROLLEYS = 20; // Total trolleys available in the facility

export class SchedulingService {
  private workOrderRepository = AppDataSource.getRepository(WorkOrder);
  private lineRepository = AppDataSource.getRepository(Line);

  // Get available lines for scheduling with constraints
  private async getAvailableLines(constraints: SchedulingConstraints): Promise<Line[]> {
    return this.lineRepository.find({
      where: {
        status: LineStatus.ACTIVE,
        isActive: true,
        maxTrolleyCapacity: MoreThanOrEqual(constraints.trolleysRequired)
      }
    });
  }

  // Calculate total trolleys in use for a given time period
  private async calculateTrolleysInUse(startDate: Date, endDate: Date, excludeWorkOrderId?: string): Promise<number> {
    const overlappingOrders = await this.workOrderRepository.find({
      where: {
        id: excludeWorkOrderId ? Not(excludeWorkOrderId) : undefined,
        startDate: LessThanOrEqual(endDate),
        isCompleted: false,
        lineId: Not(IsNull())
      }
    });

    return overlappingOrders.reduce((total, order) => total + order.trolleysRequired, 0);
  }

  // Check if a line has capacity for a work order
  private async hasLineCapacity(line: Line, workOrder: WorkOrder, startTime: Date): Promise<boolean> {
    // Check trolley capacity
    if (line.maxTrolleyCapacity < workOrder.trolleysRequired) {
      return false;
    }

    // Calculate end time for this work order
    const endTime = new Date(startTime.getTime() + workOrder.totalJobTime * 60 * 1000);

    // Get total trolleys that would be in use during this period
    const trolleysInUse = await this.calculateTrolleysInUse(startTime, endTime, workOrder.id);

    // Check if adding this work order would exceed total trolley capacity
    if (trolleysInUse + workOrder.trolleysRequired > TOTAL_TROLLEYS) {
      return false;
    }

    // Check time slot availability
    const existingOrders = await this.workOrderRepository.find({
      where: {
        lineId: line.id,
        startDate: Between(startTime, endTime)
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

  // Adjust time to working hours (7:30 AM - 4:30 PM)
  private adjustToWorkingHours(date: Date): Date {
    const adjustedDate = new Date(date);
    adjustedDate.setSeconds(0);
    adjustedDate.setMilliseconds(0);

    const hours = adjustedDate.getHours();
    const minutes = adjustedDate.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // Before 7:30 AM
    if (totalMinutes < 450) { // 7:30 = 7 * 60 + 30 = 450
      adjustedDate.setHours(7);
      adjustedDate.setMinutes(30);
    }
    // After 4:30 PM
    else if (totalMinutes > 1050) { // 16:30 = 16 * 60 + 30 = 990
      adjustedDate.setDate(adjustedDate.getDate() + 1);
      adjustedDate.setHours(7);
      adjustedDate.setMinutes(30);
    }

    return adjustedDate;
  }

  // Schedule a single work order
  public async scheduleWorkOrder(workOrder: WorkOrder): Promise<WorkOrder> {
    // Calculate job times if not already set
    workOrder.calculateTotalJobTime();
    workOrder.calculateTrolleysRequired();

    // Get scheduling constraints
    const constraints: SchedulingConstraints = {
      trolleysRequired: workOrder.trolleysRequired,
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

    // Add priority for orders requiring more trolleys (harder to schedule)
    score += workOrder.trolleysRequired * 25;

    return score;
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

  // Update work order schedule (for drag and drop)
  public async updateWorkOrderSchedule(
    workOrder: WorkOrder,
    newLineId: string,
    newStartDate: Date
  ): Promise<WorkOrder> {
    // Validate the line exists and is active
    const line = await this.lineRepository.findOne({
      where: { id: newLineId, status: LineStatus.ACTIVE }
    });

    if (!line) {
      throw new Error(`Line ${newLineId} is either invalid or inactive. Please select an active line.`);
    }

    // Ensure trolley requirements are calculated
    workOrder.calculateTrolleysRequired();
    
    // Check if line meets trolley requirements
    if (line.maxTrolleyCapacity < workOrder.trolleysRequired) {
      throw new Error(
        `Line ${line.name} has insufficient trolley capacity. ` +
        `Required: ${workOrder.trolleysRequired}, Maximum: ${line.maxTrolleyCapacity}`
      );
    }

    // Adjust start date to working hours
    const adjustedStartDate = this.adjustToWorkingHours(newStartDate);

    // Calculate end date
    const endDate = new Date(adjustedStartDate.getTime() + workOrder.totalJobTime * 60 * 1000);

    // Check trolley availability across all lines
    const trolleysInUse = await this.calculateTrolleysInUse(adjustedStartDate, endDate, workOrder.id);
    if (trolleysInUse + workOrder.trolleysRequired > TOTAL_TROLLEYS) {
      throw new Error(
        `Insufficient trolleys available for this time slot. ` +
        `Required: ${workOrder.trolleysRequired}, Available: ${TOTAL_TROLLEYS - trolleysInUse}`
      );
    }

    // Check for schedule conflicts
    const conflictingOrders = await this.workOrderRepository.find({
      where: {
        lineId: newLineId,
        id: Not(workOrder.id),
        startDate: Between(adjustedStartDate, endDate)
      }
    });

    if (conflictingOrders.length > 0) {
      const conflictingWOs = conflictingOrders.map(wo => wo.woId).join(', ');
      throw new Error(
        `Schedule conflict detected with existing work orders: ${conflictingWOs}. ` +
        `Please choose a different time slot.`
      );
    }

    // Update work order
    workOrder.lineId = newLineId;
    workOrder.startDate = adjustedStartDate;

    // Save and return updated work order
    return this.workOrderRepository.save(workOrder);
  }
} 