import React, { useMemo } from 'react';
import type { WorkOrder, Line } from '../types';
import { WorkOrderCard } from './WorkOrderCard';
import { DropCell } from './DropCell';

interface MonthViewGridProps {
  dateRange: Date[];
  currentDate: Date;
  lines: Line[];
  workOrdersByLine: { [key: string]: WorkOrder[] };
  onDrop: (item: any, date: Date, lineId: string) => void;
  getLineColor: (lineId: string | undefined) => string;
  calculateWorkOrderSpan: (wo: WorkOrder) => number;
}

interface WorkOrderWithRow extends WorkOrder {
  rowIndex?: number;
  originalLineId?: string;
}

export const MonthViewGrid: React.FC<MonthViewGridProps> = ({
  dateRange,
  currentDate,
  lines,
  workOrdersByLine,
  onDrop,
  getLineColor,
  calculateWorkOrderSpan,
}) => {
  // Pre-process work orders to assign them to rows within their line's section
  const { workOrderRows, maxRows } = useMemo(() => {
    const rows: { [key: string]: WorkOrderWithRow[] } = {};
    let maxRowCount = 0;

    // Process each line's work orders separately
    lines.forEach((line, lineIndex) => {
      const lineWorkOrders = workOrdersByLine[line.id] || [];
      
      // Sort work orders by start date within this line
      const sortedWorkOrders = lineWorkOrders
        .map(wo => ({
          ...wo,
          originalLineId: line.id
        }))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      // For each work order in this line
      sortedWorkOrders.forEach(wo => {
        const woStartDate = new Date(wo.startDate);
        const woEndDate = new Date(woStartDate);
        woEndDate.setDate(woEndDate.getDate() + calculateWorkOrderSpan(wo) - 1);
        
        // Calculate base row for this line
        const baseRow = lineIndex * 3; // Give each line 3 rows to work with
        
        // Find first available row within this line's section
        let subRow = 0;
        while (subRow < 3) { // Limit to 3 rows per line
          const actualRow = baseRow + subRow;
          const row = rows[actualRow] || [];
          
          const hasOverlap = row.some(existingWo => {
            const existingStart = new Date(existingWo.startDate);
            const existingEnd = new Date(existingStart);
            existingEnd.setDate(existingEnd.getDate() + calculateWorkOrderSpan(existingWo) - 1);
            
            return woStartDate <= existingEnd && woEndDate >= existingStart;
          });
          
          if (!hasOverlap) {
            rows[actualRow] = [...row, wo];
            (wo as WorkOrderWithRow).rowIndex = actualRow;
            maxRowCount = Math.max(maxRowCount, actualRow + 1);
            break;
          }
          subRow++;
        }
        
        // If no space found in the 3 rows, add to the last row
        if (subRow === 3) {
          const actualRow = baseRow + 2;
          rows[actualRow] = [...(rows[actualRow] || []), wo];
          (wo as WorkOrderWithRow).rowIndex = actualRow;
          maxRowCount = Math.max(maxRowCount, actualRow + 1);
        }
      });
    });
    
    return {
      workOrderRows: rows,
      maxRows: maxRowCount
    };
  }, [lines, workOrdersByLine, calculateWorkOrderSpan]);

  return (
    <div className="grid grid-cols-7 gap-1">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
        <div key={day} className="text-center p-2 font-medium sticky top-0 bg-white z-10">
          {day}
        </div>
      ))}
      <div className="col-span-7 grid grid-cols-7 gap-1 relative">
        {dateRange.map((date) => (
          <div
            key={date.toISOString()}
            className={`
              border rounded-lg overflow-hidden
              ${date.getMonth() === currentDate.getMonth() ? 'bg-white' : 'bg-gray-50'}
              min-h-[${Math.max(400, (maxRows + 1) * 40 + 40)}px]
            `}
          >
            <div className="p-1 text-sm border-b bg-inherit sticky top-0 z-10">
              {date.getDate()}
            </div>
            <DropCell
              date={date}
              lineId={null}
              workOrders={[]}
              onDrop={onDrop}
              getLineColor={getLineColor}
              line={null}
              lines={lines}
            />
          </div>
        ))}
        {/* Render work orders in their assigned rows */}
        {Object.entries(workOrderRows).map(([rowIndex, workOrders]) => (
          <div key={rowIndex} className="absolute inset-0 grid grid-cols-7 pointer-events-none">
            {workOrders.map((wo) => {
              const woStartDate = new Date(wo.startDate);
              const spanDays = calculateWorkOrderSpan(wo);
              const startDayIndex = dateRange.findIndex(
                date => date.toDateString() === woStartDate.toDateString()
              );
              
              if (startDayIndex === -1) return null;

              return (
                <div
                  key={wo.id}
                  className="relative"
                  style={{
                    gridColumn: `${startDayIndex + 1} / span ${Math.min(spanDays, 7 - startDayIndex)}`,
                    gridRow: '1',
                    pointerEvents: 'auto'
                  }}
                >
                  <WorkOrderCard
                    wo={wo}
                    lineId={wo.originalLineId || wo.lineId}
                    getLineColor={getLineColor}
                    currentDate={dateRange[startDayIndex]}
                    style={{
                      position: 'absolute',
                      top: `${Number(rowIndex) * 40 + 40}px`,
                      left: '4px',
                      right: '4px',
                      zIndex: 10,
                      minHeight: '32px'
                    }}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}; 