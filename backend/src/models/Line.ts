import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { WorkOrder } from './WorkOrder';

export enum LineStatus {
  ACTIVE = 'active',
  DOWN = 'down',
  MAINTENANCE = 'maintenance'
}

@Entity('lines')
export class Line {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({
    type: 'enum',
    enum: LineStatus,
    default: LineStatus.ACTIVE
  })
  status!: LineStatus;

  @Column('int')
  feederCapacity!: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => WorkOrder, workOrder => workOrder.line)
  workOrders?: WorkOrder[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastMaintenanceDate?: Date;

  @Column({ default: true })
  isActive!: boolean;
} 