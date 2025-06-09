import React from 'react';
import { useDrop } from 'react-dnd';
import type { WorkOrder, Line, DragItem } from '../types';
import { Tooltip } from '@mui/material';

interface DropCellProps {
  date: Date;
  lineId: string | null;
  workOrders: WorkOrder[];
  onDrop: (item: DragItem, date: Date, lineId: string) => void;
  getLineColor: (lineId: string | undefined) => string;
  line: Line | null;
  lines: Line[];
}

export const DropCell: React.FC<DropCellProps> = ({
  date,
  lineId,
  workOrders,
  onDrop,
  getLineColor,
  line,
  lines
}) => {
  const [{ isOver, canDrop, item }, drop] = useDrop({
    accept: 'WORK_ORDER',
    canDrop: (item: DragItem) => {
      const dropDate = new Date(date);
      const isWeekend = dropDate.getDay() === 0 || dropDate.getDay() === 6;
      
      // If this is a day cell in month view (lineId is null)
      if (!lineId) {
        return !isWeekend; // Allow dropping on weekdays
      }

      // For specific line cells, check all constraints
      if (!line || line.status !== 'Active') {
        return false;
      }

      if (isWeekend) {
        return false;
      }

      // Check if the work order's feeder requirements fit the line
      const feederRequirement = Math.ceil(item.numberOfAssemblies * 1.2); // Simple estimation
      if (line.feederCapacity < feederRequirement) {
        return false;
      }

      return true;
    },
    drop: (item: DragItem) => {
      // If dropping in a day cell (month view), find the first active line
      const targetLineId = lineId || lines.find(l => l.status === 'Active')?.id;
      if (!targetLineId) return;
      
      onDrop(item, date, targetLineId);
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
      item: monitor.getItem(),
    }),
  });

  // Generate tooltip message based on drop validation
  const getTooltipMessage = () => {
    if (!isOver) return 'Drop here to schedule';
    
    const dropDate = new Date(date);
    const isWeekend = dropDate.getDay() === 0 || dropDate.getDay() === 6;
    
    if (isWeekend) {
      return 'Cannot schedule on weekends';
    }
    
    if (lineId && line) {
      if (line.status !== 'Active') {
        return `Line ${line.name} is not active`;
      }
      
      if (item) {
        const feederRequirement = Math.ceil(item.numberOfAssemblies * 1.2);
        if (line.feederCapacity < feederRequirement) {
          return `Insufficient feeder capacity (Need: ${feederRequirement}, Available: ${line.feederCapacity})`;
        }
      }
    }
    
    return canDrop ? 'Release to schedule' : 'Cannot drop here';
  };

  return (
    <Tooltip title={getTooltipMessage()} arrow placement="top">
      <div
        ref={drop}
        className={`
          relative p-1 border-2 transition-all duration-200
          ${isOver && canDrop ? 'border-green-500 bg-green-50' : 'border-dashed border-gray-200'}
          ${isOver && !canDrop ? 'border-red-500 bg-red-50' : ''}
          ${!lineId ? 'h-full' : 'h-[100px]'}
          hover:border-gray-300
        `}
      >
        {isOver && canDrop && (
          <div className="absolute inset-0 bg-green-500 opacity-10 pointer-events-none" />
        )}
        {isOver && !canDrop && (
          <div className="absolute inset-0 bg-red-500 opacity-10 pointer-events-none" />
        )}
        {workOrders.map((wo) => (
          <div
            key={wo.id}
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: getLineColor(wo.lineId) }}
          />
        ))}
      </div>
    </Tooltip>
  );
}; 