import React from 'react';
import { useDrag } from 'react-dnd';
import type { WorkOrder } from '../types';

interface WorkOrderCardProps {
  wo: WorkOrder;
  lineId: string;
  getLineColor: (lineId: string | undefined) => string;
  currentDate: Date;
  style?: React.CSSProperties;
}

export const WorkOrderCard: React.FC<WorkOrderCardProps> = ({
  wo,
  lineId,
  getLineColor,
  currentDate,
  style = {}
}) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'WORK_ORDER',
    item: {
      type: 'WORK_ORDER',
      id: wo.id,
      sourceLineId: lineId,
      startDate: wo.startDate,
      woId: wo.woId,
      assemblyCycleTime: wo.assemblyCycleTime,
      numberOfAssemblies: wo.numberOfAssemblies,
      totalJobTime: wo.totalJobTime
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      className={`
        rounded px-2 py-1 text-xs cursor-move select-none
        ${isDragging ? 'opacity-50' : ''}
        transition-all duration-200
        hover:shadow-md
        ${getLineColor(wo.lineId || lineId)}
      `}
      style={{
        ...style
      }}
    >
      <div className="font-medium truncate">
        {wo.woId}
      </div>
      <div className="text-xs opacity-75 truncate">
        {wo.numberOfAssemblies} units • {Math.round(wo.totalJobTime / 60)} hrs
      </div>
    </div>
  );
}; 