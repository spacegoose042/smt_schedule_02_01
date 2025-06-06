import { AppDataSource } from './database';
import { Line, LineStatus } from '../models/Line';
import { WorkOrder } from '../models/WorkOrder';

export const seedDatabase = async () => {
  try {
    // Initialize database connection
    await AppDataSource.initialize();

    // Create SMT lines
    const lineRepository = AppDataSource.getRepository(Line);
    const lines = await lineRepository.save([
      {
        name: 'SMT Line 1',
        status: LineStatus.ACTIVE,
        feederCapacity: 120,
        description: 'Main production line for high-volume assemblies',
        isActive: true
      },
      {
        name: 'SMT Line 2',
        status: LineStatus.ACTIVE,
        feederCapacity: 80,
        description: 'Flexible line for medium-volume production',
        isActive: true
      },
      {
        name: 'SMT Line 3',
        status: LineStatus.MAINTENANCE,
        feederCapacity: 160,
        description: 'High-capacity line for complex assemblies',
        isActive: false
      }
    ]);

    // Create work orders
    const workOrderRepository = AppDataSource.getRepository(WorkOrder);
    const workOrders = await workOrderRepository.save([
      {
        woId: 'WO-2024-001',
        numberOfAssemblies: 1000,
        assemblyCycleTime: 45, // seconds
        numberOfParts: 50,
        numberOfPlacements: 150,
        isDoubleSided: true,
        materialAvailableDate: new Date('2024-06-01'),
        clearToBuild: true,
        dueDate: new Date('2024-06-10'),
        startDate: new Date('2024-06-02'),
        lineId: lines[0].id,
        setupTime: 60,
        tearDownTime: 60,
        totalJobTime: 900
      },
      {
        woId: 'WO-2024-002',
        numberOfAssemblies: 500,
        assemblyCycleTime: 30,
        numberOfParts: 30,
        numberOfPlacements: 90,
        isDoubleSided: false,
        materialAvailableDate: new Date('2024-06-05'),
        clearToBuild: true,
        dueDate: new Date('2024-06-15'),
        lineId: lines[1].id,
        setupTime: 45,
        tearDownTime: 45,
        totalJobTime: 450
      },
      {
        woId: 'WO-2024-003',
        numberOfAssemblies: 2000,
        assemblyCycleTime: 60,
        numberOfParts: 80,
        numberOfPlacements: 240,
        isDoubleSided: true,
        materialAvailableDate: new Date('2024-06-10'),
        clearToBuild: false,
        dueDate: new Date('2024-06-25'),
        setupTime: 90,
        tearDownTime: 90,
        totalJobTime: 2180
      }
    ]);

    console.log('Database seeded successfully!');
    console.log(`Created ${lines.length} lines and ${workOrders.length} work orders`);

  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await AppDataSource.destroy();
  }
}; 