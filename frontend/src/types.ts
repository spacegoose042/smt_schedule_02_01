export interface WorkOrder {
  id: string;
  woId: string;
  startDate: string;
  totalJobTime: number;
  numberOfAssemblies: number;
  lineId?: string;
  assemblyCycleTime: number;
  setupTime?: number;
  tearDownTime?: number;
}

export interface Line {
  id: string;
  name: string;
  status: string;
  feederCapacity: number;
}

export interface DragItem {
  type: 'WORK_ORDER';
  id: string;
  sourceLineId: string;
  startDate: string;
  woId: string;
  assemblyCycleTime: number;
  numberOfAssemblies: number;
  totalJobTime: number;
} 