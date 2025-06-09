import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Line } from './Line';

export enum MaterialStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  COMPLETE = 'complete',
  MISSING = 'missing'
}

export enum WorkOrderPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

@Entity('work_orders')
export class WorkOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  woId!: string;

  @Column('int')
  numberOfAssemblies!: number;

  @Column('float')
  assemblyCycleTime!: number; // in seconds per assembly

  @Column('int')
  numberOfParts!: number;

  @Column('int')
  numberOfPlacements!: number;

  @Column('boolean', { default: false })
  isDoubleSided!: boolean;

  @Column('int', { default: 1 })
  trolleysRequired!: number;

  @Column({ type: 'timestamp' })
  materialAvailableDate!: Date;

  @Column('boolean', { default: false })
  clearToBuild!: boolean;

  @Column({
    type: 'enum',
    enum: MaterialStatus,
    default: MaterialStatus.PENDING
  })
  materialStatus!: MaterialStatus;

  @Column({ type: 'jsonb', nullable: true })
  materialList?: {
    partNumber: string;
    quantity: number;
    available: number;
    reference?: string;
  }[];

  @Column({
    type: 'enum',
    enum: WorkOrderPriority,
    default: WorkOrderPriority.MEDIUM
  })
  priority!: WorkOrderPriority;

  @Column({ type: 'timestamp' })
  dueDate!: Date;

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date;

  @Column('float')
  setupTime!: number; // in minutes

  @Column('float')
  tearDownTime!: number; // in minutes

  @Column('float')
  totalJobTime!: number; // in minutes

  @ManyToOne(() => Line, line => line.workOrders)
  @JoinColumn({ name: 'lineId' })
  line?: Line;

  @Column({ type: 'uuid', nullable: true })
  lineId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column('boolean', { default: false })
  isCompleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // Calculated fields that will be set by service layer
  calculateSetupTearDownTime(): number {
    const baseTime = Math.max(5 * this.numberOfParts, 45);
    this.setupTime = baseTime;
    this.tearDownTime = baseTime;
    return baseTime;
  }

  calculateTotalJobTime(): void {
    // Calculate setup and tear down time
    this.calculateSetupTearDownTime();
    
    // Calculate total job time
    const totalAssemblyTime = (this.assemblyCycleTime * this.numberOfAssemblies) / 60; // Convert to minutes
    this.totalJobTime = this.setupTime + totalAssemblyTime + this.tearDownTime;
  }

  updateMaterialStatus(): void {
    if (!this.materialList || this.materialList.length === 0) {
      this.materialStatus = MaterialStatus.PENDING;
      return;
    }

    const totalParts = this.materialList.length;
    const availableParts = this.materialList.filter(
      material => material.available >= material.quantity
    ).length;

    if (availableParts === 0) {
      this.materialStatus = MaterialStatus.MISSING;
    } else if (availableParts === totalParts) {
      this.materialStatus = MaterialStatus.COMPLETE;
    } else {
      this.materialStatus = MaterialStatus.PARTIAL;
    }
  }
} 