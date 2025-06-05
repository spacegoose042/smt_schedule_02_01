import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Line } from './Line';

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

  @Column({ type: 'timestamp' })
  materialAvailableDate!: Date;

  @Column('boolean', { default: false })
  clearToBuild!: boolean;

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

  // Calculated fields that will be set by service layer
  calculateSetupTearDownTime(): number {
    const baseTime = Math.max(5 * this.numberOfParts, 45);
    this.setupTime = baseTime;
    this.tearDownTime = baseTime;
    return baseTime;
  }

  calculateTotalJobTime(): number {
    const setupTearDown = this.calculateSetupTearDownTime();
    const assemblyTime = (this.numberOfAssemblies * this.assemblyCycleTime) / 60; // Convert seconds to minutes
    this.totalJobTime = setupTearDown * 2 + assemblyTime; // Setup + Assembly + Tear Down
    return this.totalJobTime;
  }
} 