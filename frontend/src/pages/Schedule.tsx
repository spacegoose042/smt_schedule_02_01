import React from 'react';
import { DndProvider, useDrag } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Paper, Button, CircularProgress, IconButton, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { useAuthInterceptor } from '../config/axios';
import { ErrorBoundary } from 'react-error-boundary';
import { toast } from 'react-toastify';
import { MonthViewGrid } from '../components/MonthViewGrid';
import { DragPreview } from '../components/DragPreview';
import { DropCell } from '../components/DropCell';

const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => {
  return (
    <div className="flex flex-col items-center justify-center h-[700px] space-y-4">
      <div className="text-lg text-red-600">Something went wrong with the scheduler</div>
      <div className="text-sm text-gray-600">{error.message}</div>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Try again
      </button>
    </div>
  );
};

type ViewType = 'day' | 'week' | 'month';

// Color mapping for SMT lines
const LINE_COLORS = [
  'bg-blue-200 hover:bg-blue-300',
  'bg-green-200 hover:bg-green-300',
  'bg-purple-200 hover:bg-purple-300',
  'bg-orange-200 hover:bg-orange-300',
  'bg-pink-200 hover:bg-pink-300',
  'bg-yellow-200 hover:bg-yellow-300',
  'bg-indigo-200 hover:bg-indigo-300',
  'bg-red-200 hover:bg-red-300'
];

interface DragItem {
  type: 'WORK_ORDER';
  id: string;
  sourceLineId: string;
  startDate: string;
  woId: string;
  assemblyCycleTime: number;
  numberOfAssemblies: number;
  totalJobTime: number;
}

interface Line {
  id: string;
  name: string;
  status: string;
  feederCapacity: number;
}

interface WorkOrder {
  id: string;
  woId: string;
  startDate: string;
  totalJobTime: number;
  numberOfAssemblies: number;
  lineId?: string;
  assemblyCycleTime: number;
  setupTime?: number;
  tearDownTime?: number;
  verticalPosition?: number;
}

interface WorkOrderWithSpan extends WorkOrder {
  spanDays: number;
  isStart: boolean;
}

const calculateWorkOrderSpan = (wo: WorkOrder): number => {
  const totalMinutes = wo.totalJobTime;
  const workingHoursPerDay = 9; // 7:30 AM to 4:30 PM = 9 hours
  const minutesPerDay = workingHoursPerDay * 60;
  return Math.ceil(totalMinutes / minutesPerDay);
};

const WorkOrderCard = ({ wo, lineId, getLineColor, currentDate, style = {} }: { 
  wo: WorkOrder; 
  lineId: string; 
  getLineColor: (lineId: string | undefined) => string;
  currentDate: Date;
  style?: React.CSSProperties;
}) => {
  const spanDays = calculateWorkOrderSpan(wo);
  const woStartDate = new Date(wo.startDate);
  const woEndDate = new Date(woStartDate);
  woEndDate.setDate(woEndDate.getDate() + spanDays - 1);
  
  const daysPassed = Math.floor((currentDate.getTime() - woStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const progress = Math.min(100, (daysPassed + 1) / spanDays * 100);

  const [{ isDragging }, drag] = useDrag(() => ({
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
      isDragging: monitor.isDragging(),
    }),
  }), [wo, lineId]);

  const tooltipContent = `
    Work Order: ${wo.woId}
    Start Date: ${woStartDate.toLocaleDateString()}
    End Date: ${woEndDate.toLocaleDateString()}
    Duration: ${Math.round(wo.totalJobTime)}m
    Cycle Time: ${wo.assemblyCycleTime}m
    Assemblies: ${wo.numberOfAssemblies}
    Progress: ${Math.round(progress)}%
  `;

  return (
    <div
      ref={drag}
      className={`
        ${getLineColor(wo.lineId)}
        px-2 py-1 rounded cursor-move
        hover:shadow-sm transition-all duration-200
        select-none touch-none
        active:cursor-grabbing
        relative
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
      `}
      style={{
        ...style,
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? 'scale(0.95)' : 'scale(1)',
      }}
      title={tooltipContent}
    >
      <div className="font-medium truncate">{wo.woId}</div>
      <div className="flex items-center gap-1">
        <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary-500 transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-gray-600 whitespace-nowrap">{Math.round(wo.totalJobTime)}m</div>
      </div>
      <div className="text-xs text-gray-500 truncate">
        {woStartDate.toLocaleDateString()} - {woEndDate.toLocaleDateString()}
      </div>
    </div>
  );
};

const MultiDayWorkOrders = ({ workOrders, lineId, getLineColor, dateRange }: {
  workOrders: WorkOrder[];
  lineId: string;
  getLineColor: (lineId: string | undefined) => string;
  dateRange: Date[];
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="grid grid-cols-7 h-full">
        {workOrders.map((wo: WorkOrder) => {
          const woStartDate = new Date(wo.startDate);
          const spanDays = calculateWorkOrderSpan(wo);
          const startDayIndex = dateRange.findIndex(
            date => date.toDateString() === woStartDate.toDateString()
          );
          
          if (startDayIndex === -1) return null;
          
          return (
            <WorkOrderCard
              key={wo.id}
              wo={wo}
              lineId={lineId}
              getLineColor={getLineColor}
              currentDate={dateRange[startDayIndex]}
              style={{
                gridColumn: `${startDayIndex + 1} / span ${spanDays}`,
                gridRow: '1',
                minHeight: '3rem',
                pointerEvents: 'auto',
                zIndex: 10
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

const MonthViewWorkOrder = ({ wo, lineId, getLineColor, date }: {
  wo: WorkOrder;
  lineId: string;
  getLineColor: (lineId: string | undefined) => string;
  date: Date;
}) => {
  const spanDays = calculateWorkOrderSpan(wo);
  const woStartDate = new Date(wo.startDate);
  const woEndDate = new Date(woStartDate);
  woEndDate.setDate(woEndDate.getDate() + spanDays - 1);
  
  const daysPassed = Math.floor((date.getTime() - woStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const progress = Math.min(100, (daysPassed + 1) / spanDays * 100);

  const [{ isDragging }, drag] = useDrag(() => ({
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
      isDragging: monitor.isDragging(),
    }),
  }), [wo, lineId]);

  return (
    <div
      ref={drag}
      className={`
        ${getLineColor(wo.lineId)}
        px-1 py-0.5 rounded cursor-move
        hover:shadow-sm transition-all duration-200
        select-none touch-none
        active:cursor-grabbing
        relative
        text-[10px]
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
      `}
      style={{
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? 'scale(0.95)' : 'scale(1)',
      }}
    >
      <div className="font-medium truncate">{wo.woId}</div>
      <div className="flex items-center gap-1">
        <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary-500 transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-gray-600 whitespace-nowrap">{Math.round(wo.totalJobTime)}m</div>
      </div>
    </div>
  );
};

const Schedule = () => {
  useAuthInterceptor();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date('2024-06-08'));
  const [view, setView] = React.useState<ViewType>('week');

  // Query for SMT lines
  const { data: lines = [], isLoading: isLinesLoading } = useQuery({
    queryKey: ['lines'],
    queryFn: async () => {
      const response = await api.get('/api/lines');
      return response.data || [];
    },
  });

  // Create a memoized color mapping for lines
  const lineColorMap = React.useMemo(() => {
    const colorMap = new Map();
    lines.forEach((line: Line, index: number) => {
      const color = LINE_COLORS[index % LINE_COLORS.length];
      colorMap.set(line.id, color);
    });
    return colorMap;
  }, [lines]);

  // Helper function to get line color
  const getLineColor = (lineId: string | undefined) => {
    if (!lineId) return 'bg-gray-200'; // Unassigned
    const color = lineColorMap.get(lineId);
    return color || 'bg-gray-200';
  };

  // Query for work orders
  const { data: workOrders = [], isLoading: isWorkOrdersLoading } = useQuery({
    queryKey: ['workOrders'],
    queryFn: async () => {
      const response = await api.get('/api/work-orders');
      return response.data || [];
    },
  });

  // Process work orders by line
  const workOrdersByLine = React.useMemo(() => {
    const ordersByLine: Record<string, WorkOrder[]> = {
      unassigned: []
    };

    // Initialize arrays for each line
    lines.forEach((line: Line) => {
      ordersByLine[line.id] = [];
    });

    // Sort work orders into their respective lines
    workOrders.forEach((wo: WorkOrder) => {
      if (!wo?.startDate || !wo?.assemblyCycleTime || !wo?.numberOfAssemblies) return;

      if (wo.lineId && ordersByLine[wo.lineId]) {
        ordersByLine[wo.lineId].push(wo);
      } else {
        ordersByLine.unassigned.push(wo);
      }
    });

    return ordersByLine;
  }, [workOrders, lines]);

  // Calculate the date range for the current view
  const dateRange = React.useMemo(() => {
    const dates = [];
    const startDate = new Date(currentDate);
    
    if (view === 'week') {
      startDate.setDate(currentDate.getDate() - currentDate.getDay());
      for (let i = 0; i < 7; i++) {
        const newDate = new Date(startDate);
        newDate.setDate(newDate.getDate() + i);
        dates.push(newDate);
      }
    } else if (view === 'month') {
      startDate.setDate(1);
      const firstDay = startDate.getDay();
      
      const prevMonth = new Date(startDate);
      prevMonth.setDate(0);
      for (let i = firstDay - 1; i >= 0; i--) {
        const newDate = new Date(prevMonth);
        newDate.setDate(prevMonth.getDate() - i);
        dates.push(newDate);
      }
      
      const lastDay = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= lastDay; i++) {
        const newDate = new Date(startDate);
        newDate.setDate(i);
        dates.push(newDate);
      }
      
      const remainingDays = 42 - dates.length;
      const nextMonth = new Date(startDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
      for (let i = 0; i < remainingDays; i++) {
        const newDate = new Date(nextMonth);
        newDate.setDate(nextMonth.getDate() + i);
        dates.push(newDate);
      }
    } else {
      dates.push(new Date(currentDate));
    }
    
    return dates;
  }, [currentDate, view]);

  // Navigation handlers
  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (view === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleViewChange = (_event: React.MouseEvent<HTMLElement>, newView: ViewType) => {
    if (newView !== null) {
      setView(newView);
    }
  };

  const handleDrop = async (item: DragItem, targetDate: Date, targetLineId: string) => {
    try {
      // Adjust target date to start of day for consistency
      const adjustedDate = new Date(targetDate);
      adjustedDate.setHours(7, 30, 0, 0); // Set to 7:30 AM

      // Optimistically update the UI
      const updatedWorkOrders = workOrders.map(wo => {
        if (wo.id === item.id) {
          return {
            ...wo,
            startDate: adjustedDate.toISOString(),
            lineId: targetLineId
          };
        }
        return wo;
      });

      // Update the queryClient cache immediately
      queryClient.setQueryData(['workOrders'], updatedWorkOrders);

      // Make the API call
      await api.post(`/api/work-orders/${item.id}/schedule`, {
        startDate: adjustedDate.toISOString(),
        lineId: targetLineId
      });

      // Refetch to ensure consistency
      queryClient.invalidateQueries(['workOrders']);

      toast.success('Work order rescheduled successfully');
    } catch (error: any) {
      console.error('Failed to reschedule work order:', error);
      // Revert the optimistic update
      queryClient.invalidateQueries(['workOrders']);
      toast.error(error.response?.data?.message || 'Failed to reschedule work order');
    }
  };

  const renderDayView = () => (
    <div className="grid grid-cols-1 gap-4">
      <div className="text-center p-2 font-medium border-b">
        {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </div>
      {lines.map((line: Line) => {
        // Get unique work orders for this line and date
        const lineWorkOrders = [...new Set(workOrdersByLine[line.id])]?.filter((wo: WorkOrder) => {
          if (!wo.startDate) return false;
          
          const woStartDate = new Date(wo.startDate);
          woStartDate.setHours(0, 0, 0, 0);
          const woEndDate = new Date(woStartDate);
          woEndDate.setDate(woEndDate.getDate() + calculateWorkOrderSpan(wo) - 1);
          woEndDate.setHours(23, 59, 59, 999);
          
          const currentDateStart = new Date(currentDate);
          currentDateStart.setHours(0, 0, 0, 0);
          
          // Only show work orders that overlap with the current date
          return (
            currentDateStart >= woStartDate &&
            currentDateStart <= woEndDate
          );
        }) || [];

        // Sort work orders by start date
        const sortedWorkOrders = lineWorkOrders.sort((a, b) => 
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );

        return (
          <div key={line.id} className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-2">
              <div className="font-medium">{line.name}</div>
              <div className="text-xs text-gray-600">
                Status: {line.status} • Feeder Capacity: {line.feederCapacity}
              </div>
            </div>
            <div className="relative p-2 min-h-[100px]">
              <DropCell
                date={currentDate}
                lineId={line.id}
                workOrders={[]}
                onDrop={handleDrop}
                getLineColor={getLineColor}
                line={line}
                lines={lines}
              />
              {/* Render work orders */}
              <div className="absolute inset-0 p-2">
                {sortedWorkOrders.map((wo: WorkOrder) => (
                  <div key={wo.id} className="mb-2">
                    <WorkOrderCard
                      wo={wo}
                      lineId={line.id}
                      getLineColor={getLineColor}
                      currentDate={currentDate}
                      style={{
                        pointerEvents: 'auto',
                        zIndex: 10
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderWeekView = () => (
    <div className="grid grid-cols-[auto_1fr] gap-0">
      <div className="sticky left-0 bg-white z-10">
        <div className="h-[60px] border-b flex items-center justify-center font-medium bg-gray-50">
          Lines
        </div>
        {lines.map((line: Line) => (
          <div 
            key={line.id} 
            className={`
              h-[100px] flex flex-col justify-center p-4 border-b border-r
              ${line.status === 'Active' ? 'bg-white' : 'bg-gray-50'}
            `}
          >
            <div className="flex items-center gap-2">
              <div 
                className={`w-2 h-2 rounded-full ${line.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`} 
              />
              <div className="font-medium">{line.name}</div>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Status: {line.status} • Feeder Capacity: {line.feederCapacity}
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          <div className="grid grid-cols-7">
            {dateRange.map((date) => (
              <div 
                key={date.toISOString()} 
                className="text-center p-2 h-[60px] font-medium border-b flex flex-col items-center justify-center bg-gray-50"
              >
                <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className="text-sm text-gray-600">
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
          {lines.map((line: Line) => (
            <div 
              key={line.id} 
              className={`
                relative h-[100px] border-b
                ${line.status === 'Active' ? '' : 'bg-gray-50/50'}
              `}
            >
              <div className="grid grid-cols-7 h-full">
                {dateRange.map((date) => (
                  <DropCell
                    key={date.toISOString()}
                    date={date}
                    lineId={line.id}
                    workOrders={[]}
                    onDrop={handleDrop}
                    getLineColor={getLineColor}
                    line={line}
                    lines={lines}
                  />
                ))}
              </div>
              {/* Render work orders that span multiple days */}
              {workOrdersByLine[line.id]?.map((wo: WorkOrder) => {
                const woStartDate = new Date(wo.startDate);
                const spanDays = calculateWorkOrderSpan(wo);
                const startDayIndex = dateRange.findIndex(
                  date => date.toDateString() === woStartDate.toDateString()
                );
                
                if (startDayIndex === -1) return null;
                
                return (
                  <div
                    key={wo.id}
                    className="absolute"
                    style={{
                      left: `calc(${(startDayIndex / 7) * 100}% + 4px)`,
                      width: `calc(${(Math.min(spanDays, 7 - startDayIndex) / 7) * 100}% - 8px)`,
                      top: '4px',
                      height: 'calc(100% - 8px)',
                      zIndex: 10
                    }}
                  >
                    <WorkOrderCard
                      wo={wo}
                      lineId={line.id}
                      getLineColor={getLineColor}
                      currentDate={dateRange[startDayIndex]}
                      style={{
                        height: '100%'
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMonthView = () => (
    <MonthViewGrid
      dateRange={dateRange}
      currentDate={currentDate}
      lines={lines}
      workOrdersByLine={workOrdersByLine}
      onDrop={handleDrop}
      getLineColor={getLineColor}
      calculateWorkOrderSpan={calculateWorkOrderSpan}
    />
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Production Schedule</h1>
          <div className="flex items-center space-x-2">
            <IconButton onClick={handlePrevious} size="small">
              <ChevronLeftIcon className="h-5 w-5" />
            </IconButton>
            <Button
              variant="text"
              onClick={handleToday}
              className="text-primary-600 hover:text-primary-700"
            >
              Today
            </Button>
            <IconButton onClick={handleNext} size="small">
              <ChevronRightIcon className="h-5 w-5" />
            </IconButton>
          </div>
          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={handleViewChange}
            size="small"
          >
            <ToggleButton value="day">Day</ToggleButton>
            <ToggleButton value="week">Week</ToggleButton>
            <ToggleButton value="month">Month</ToggleButton>
          </ToggleButtonGroup>
          <Button
            startIcon={<ArrowPathIcon className="h-5 w-5" />}
            onClick={() => {}}
            className="text-primary-600 hover:text-primary-700"
          >
            Optimize Schedule
          </Button>
        </div>
        
        {isLinesLoading || isWorkOrdersLoading ? (
          <div className="flex items-center justify-center h-[700px]">
            <CircularProgress />
          </div>
        ) : (
          <>
            {view === 'day' && renderDayView()}
            {view === 'week' && renderWeekView()}
            {view === 'month' && renderMonthView()}
            <DragPreview />
          </>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default Schedule; 