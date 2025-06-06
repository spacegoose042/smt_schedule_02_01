import React from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Paper, Button, CircularProgress, IconButton, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { useAuthInterceptor } from '../config/axios';
import { ErrorBoundary } from 'react-error-boundary';

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
  'bg-blue-100',
  'bg-green-100',
  'bg-purple-100',
  'bg-orange-100',
  'bg-pink-100',
  'bg-yellow-100',
  'bg-indigo-100',
  'bg-red-100'
];

interface DragItem {
  type: 'WORK_ORDER';
  id: string;
  sourceLineId: string;
  startDate: string;
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
    item: { type: 'WORK_ORDER', id: wo.id, sourceLineId: lineId, startDate: wo.startDate },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [wo.id, lineId, wo.startDate]);

  return (
    <div
      ref={drag}
      className={`
        ${getLineColor(wo.lineId)}
        p-2 rounded-md shadow-sm mb-1 cursor-move
        hover:shadow-md transition-all duration-200
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
        select-none touch-none
        active:cursor-grabbing
        relative
      `}
      style={{
        ...style,
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? 'scale(0.95)' : 'scale(1)',
      }}
    >
      <div className="text-sm font-medium">{wo.woId}</div>
      <div className="text-xs text-gray-600">
        {wo.numberOfAssemblies} units • {Math.round(wo.totalJobTime)} min ({spanDays} days)
      </div>
      <div className="text-xs text-gray-500">
        Started: {woStartDate.toLocaleDateString()}
        {daysPassed >= 0 && ` (Day ${daysPassed + 1} of ${spanDays})`}
      </div>
      <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary-500 transition-all duration-300" 
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

const DropCell = ({ date, lineId, workOrders, onDrop, getLineColor }: { 
  date: Date; 
  lineId: string; 
  workOrders: WorkOrder[];
  onDrop: (item: DragItem, date: Date, lineId: string) => void;
  getLineColor: (lineId: string | undefined) => string;
}) => {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'WORK_ORDER',
    canDrop: (item: DragItem) => true, // Allow drops from any line
    drop: (item: DragItem) => {
      console.log('Dropping item:', item, 'onto line:', lineId, 'at date:', date);
      onDrop(item, date, lineId);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [date, lineId, onDrop]);

  return (
    <div
      ref={drop}
      className={`
        border-2 p-2 min-h-[100px]
        transition-all duration-200
        ${isOver ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}
        relative
        z-20
      `}
      style={{ pointerEvents: 'all' }}
    >
      {workOrders.map(wo => (
        <WorkOrderCard key={wo.id} wo={wo} lineId={lineId} getLineColor={getLineColor} currentDate={date} />
      ))}
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
    item: { type: 'WORK_ORDER', id: wo.id, sourceLineId: lineId, startDate: wo.startDate },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [wo.id, lineId, wo.startDate]);

  return (
    <div
      ref={drag}
      className={`
        ${getLineColor(wo.lineId)}
        p-1 rounded-md shadow-sm mb-1 cursor-move
        hover:shadow-md transition-all duration-200
        select-none touch-none
        active:cursor-grabbing
        relative
        text-xs
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
      `}
      style={{
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? 'scale(0.95)' : 'scale(1)',
      }}
    >
      <div className="font-medium truncate">{wo.woId}</div>
      <div className="text-gray-600 truncate">
        {wo.numberOfAssemblies} units • {Math.round(wo.totalJobTime)} min
      </div>
      <div className="text-gray-500 truncate">
        Day {daysPassed + 1} of {spanDays}
      </div>
      <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary-500 transition-all duration-300" 
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

const Schedule = () => {
  useAuthInterceptor();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
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
      console.log('Dropping work order:', { item, targetDate, targetLineId });
      const response = await api.post(`/api/work-orders/${item.id}/schedule`, {
        lineId: targetLineId,
        startDate: targetDate.toISOString()
      });
      
      if (response.data) {
        console.log('Schedule update successful:', response.data);
        queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      }
    } catch (error) {
      console.error('Failed to update work order schedule:', error);
      // TODO: Show error toast
    }
  };

  const renderDayView = () => (
    <div className="grid grid-cols-1 gap-4">
      {lines.map((line: Line) => (
        <div key={line.id} className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 p-2 font-medium">{line.name}</div>
          <div className="relative">
            <DropCell
              date={currentDate}
              lineId={line.id}
              workOrders={[]}
              onDrop={handleDrop}
              getLineColor={getLineColor}
            />
            {/* Render work orders with their spans */}
            <div className="absolute inset-0">
              {workOrdersByLine[line.id]?.map((wo: WorkOrder) => {
                const woStartDate = new Date(wo.startDate);
                const spanDays = calculateWorkOrderSpan(wo);
                
                // Only show work orders that start on or before the current date
                // and end on or after the current date
                const woEndDate = new Date(woStartDate);
                woEndDate.setDate(woEndDate.getDate() + spanDays - 1);
                
                if (currentDate >= woStartDate && currentDate <= woEndDate) {
                  return (
                    <WorkOrderCard
                      key={wo.id}
                      wo={wo}
                      lineId={line.id}
                      getLineColor={getLineColor}
                      currentDate={currentDate}
                      style={{
                        pointerEvents: 'auto',
                        zIndex: 10
                      }}
                    />
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderWeekView = () => (
    <div className="grid grid-cols-[auto_1fr] gap-4">
      <div className="sticky left-0 bg-white z-10">
        <div className="h-10" />
        {lines.map((line: Line) => (
          <div key={line.id} className="h-[100px] flex items-center p-2 font-medium">
            {line.name}
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          <div className="grid grid-cols-7">
            {dateRange.map((date) => (
              <div key={date.toISOString()} className="text-center p-2 font-medium border-b">
                {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            ))}
          </div>
          {lines.map((line: Line) => (
            <div key={line.id} className="grid grid-cols-7 relative">
              {dateRange.map((date) => (
                <DropCell
                  key={date.toISOString()}
                  date={date}
                  lineId={line.id}
                  workOrders={[]}
                  onDrop={handleDrop}
                  getLineColor={getLineColor}
                />
              ))}
              {/* Render work orders that span multiple days */}
              <div className="absolute inset-0">
                <div className="grid grid-cols-7 h-full">
                  {workOrdersByLine[line.id]?.map((wo: WorkOrder) => {
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
                        lineId={line.id}
                        getLineColor={getLineColor}
                        currentDate={dateRange[startDayIndex]}
                        style={{
                          gridColumn: `${startDayIndex + 1} / span ${Math.min(spanDays, 7 - startDayIndex)}`,
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-1">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
        <div key={day} className="text-center p-2 font-medium">
          {day}
        </div>
      ))}
      {dateRange.map((date) => (
        <div
          key={date.toISOString()}
          className={`
            border rounded-lg overflow-hidden
            ${date.getMonth() === currentDate.getMonth() ? 'bg-white' : 'bg-gray-50'}
            min-h-[120px]
          `}
        >
          <div className="p-1 text-sm border-b bg-inherit">
            {date.getDate()}
          </div>
          <div className="p-1">
            {lines.map((line: Line) => {
              const lineWorkOrders = workOrdersByLine[line.id]?.filter((wo: WorkOrder) => {
                const woStartDate = new Date(wo.startDate);
                const spanDays = calculateWorkOrderSpan(wo);
                const woEndDate = new Date(woStartDate);
                woEndDate.setDate(woEndDate.getDate() + spanDays - 1);
                
                // Check if the work order spans this date
                const dateStart = new Date(date);
                dateStart.setHours(0, 0, 0, 0);
                const dateEnd = new Date(date);
                dateEnd.setHours(23, 59, 59, 999);
                
                return (
                  (woStartDate <= dateEnd && woEndDate >= dateStart) || // Work order spans this date
                  (woStartDate >= dateStart && woStartDate <= dateEnd) // Work order starts on this date
                );
              });

              if (lineWorkOrders?.length === 0) return null;

              return (
                <div key={line.id} className="mb-1">
                  <div className="text-xs font-medium text-gray-500">{line.name}</div>
                  <div className="space-y-1">
                    {lineWorkOrders.map((wo) => (
                      <MonthViewWorkOrder
                        key={wo.id}
                        wo={wo}
                        lineId={line.id}
                        getLineColor={getLineColor}
                        date={date}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  if (isLinesLoading || isWorkOrdersLoading) {
    return (
      <div className="h-[700px] bg-white rounded-lg shadow flex items-center justify-center">
        <CircularProgress />
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-[700px] w-full bg-white rounded-lg shadow">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <div className="flex justify-between items-center p-4 border-b">
            <div className="flex items-center space-x-4">
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
            </div>
            <Button
              startIcon={<ArrowPathIcon className="h-5 w-5" />}
              onClick={() => {}}
              className="text-primary-600 hover:text-primary-700"
            >
              Optimize Schedule
            </Button>
          </div>

          <Paper className="flex flex-col h-full overflow-hidden">
            <div className="w-full h-full overflow-auto">
              {view === 'day' && renderDayView()}
              {view === 'week' && renderWeekView()}
              {view === 'month' && renderMonthView()}
            </div>
          </Paper>
        </ErrorBoundary>
      </div>
    </DndProvider>
  );
};

export default Schedule; 