import React from 'react';
import { useDrop } from 'react-dnd';
import type { WorkOrder, Line, DragItem } from '../types';

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
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'WORK_ORDER',
    canDrop: (item: DragItem) => {
      // If this is a day cell in month view (lineId is null)
      if (!lineId) {
        const dropDate = new Date(date);
        const isWeekend = dropDate.getDay() === 0 || dropDate.getDay() === 6;
        return !isWeekend; // Allow dropping on weekdays
      }

      // For specific line cells, check all constraints
      if (!line || line.status !== 'Active') {
        return false;
      }

      const dropDate = new Date(date);
      const isWeekend = dropDate.getDay() === 0 || dropDate.getDay() === 6;
      if (isWeekend) {
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
    }),
  });

  return (
    <div
      ref={drop}
      className={`
        relative p-1 border border-dashed transition-colors duration-200
        ${isOver && canDrop ? 'border-green-500 bg-green-50' : 'border-gray-200'}
        ${!canDrop && isOver ? 'border-red-500 bg-red-50' : ''}
        ${!lineId ? 'h-full' : 'h-[100px]'} // Full height for day cells in month view
      `}
      title={!canDrop ? 'Cannot drop here' : 'Drop to schedule'}
    >
      {workOrders.map((wo) => (
        <div
          key={wo.id}
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: getLineColor(wo.lineId) }}
        />
      ))}
    </div>
  );
}; 