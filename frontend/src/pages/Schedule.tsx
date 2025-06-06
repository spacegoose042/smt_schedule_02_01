import { useState, useMemo, useEffect } from 'react';
import {
  Scheduler,
  MonthView,
  Appointments,
  Toolbar,
  ViewSwitcher,
  DateNavigator,
  TodayButton,
  Resources,
  DragDropProvider,
  AppointmentTooltip,
  AppointmentForm,
  ConfirmationDialog,
  GroupingPanel,
  WeekView,
  TimeScaleLayout,
} from '@devexpress/dx-react-scheduler-material-ui';
import {
  ViewState,
  EditingState,
  IntegratedEditing,
  GroupingState,
  IntegratedGrouping,
} from '@devexpress/dx-react-scheduler';
import { Paper, Button } from '@mui/material';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { useAuthInterceptor } from '../config/axios';
import { ErrorBoundary } from 'react-error-boundary';

interface AppointmentData {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  lineId: string;
  priority: string;
  dueDate: Date;
  materialStatus: string;
  numberOfAssemblies: number;
  lineName: string;
}

interface Resource {
  fieldName: string;
  title: string;
  allowMultiple: boolean;
  instances: Array<{
    id: string;
    text: string;
    color: string;
  }>;
}

const AppointmentContent = (props: Appointments.AppointmentContentProps) => {
  const { data } = props;
  const appointmentData = data as unknown as AppointmentData;
  
  return (
    <Appointments.AppointmentContent {...props}>
      <div className="text-xs truncate">
        <div className="font-medium">{appointmentData.title}</div>
        <div className="flex items-center gap-1">
          <span>{appointmentData.numberOfAssemblies} units</span>
          <span className={`px-1 rounded ${
            appointmentData.priority === 'urgent' ? 'bg-red-100 text-red-800' :
            appointmentData.priority === 'high' ? 'bg-orange-100 text-orange-800' :
            appointmentData.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            {appointmentData.priority}
          </span>
        </div>
      </div>
    </Appointments.AppointmentContent>
  );
};

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

const Schedule = () => {
  useAuthInterceptor();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentViewName, setCurrentViewName] = useState('Month');
  const [isOptimizing, setIsOptimizing] = useState(false);

  const { data: lines, isLoading: isLinesLoading } = useQuery({
    queryKey: ['lines'],
    queryFn: async () => {
      const response = await api.get('/api/lines');
      return response.data;
    },
  });

  const { data: workOrders, isLoading: isWorkOrdersLoading } = useQuery({
    queryKey: ['workOrders'],
    queryFn: async () => {
      const response = await api.get('/api/work-orders');
      return response.data;
    },
  });

  // Create resources using useMemo to ensure stable reference
  const resources = useMemo<Resource[]>(() => {
    if (!lines) return [];
    
    return [{
      fieldName: 'lineId',
      title: 'Production Line',
      allowMultiple: false,
      instances: [
        {
          id: 'unassigned',
          text: 'Unassigned',
          color: '#9E9E9E'
        },
        ...lines.map((line: any) => ({
          id: line.id,
          text: line.name,
          color: line.isActive ? '#4CAF50' : '#9E9E9E'
        }))
      ]
    }];
  }, [lines]);

  // Create appointments using useMemo to ensure stable reference
  const appointments = useMemo(() => {
    if (!workOrders || !lines) return [];

    return workOrders.map((wo: any) => ({
      id: wo.id,
      title: `WO #${wo.woId}`,
      startDate: wo.startDate ? new Date(wo.startDate) : new Date(),
      endDate: wo.startDate 
        ? new Date(new Date(wo.startDate).getTime() + (wo.totalJobTime || 0) * 60 * 1000)
        : new Date(new Date().getTime() + (wo.totalJobTime || 0) * 60 * 1000),
      lineId: wo.lineId || 'unassigned',
      priority: wo.priority,
      dueDate: new Date(wo.dueDate),
      materialStatus: wo.materialStatus,
      numberOfAssemblies: wo.numberOfAssemblies,
      lineName: lines.find((line: any) => line.id === wo.lineId)?.name || 'Unassigned'
    }));
  }, [workOrders, lines]);

  // Create grouping configuration using useMemo
  const grouping = useMemo(() => [{
    resourceName: 'lineId',
    columnExtensions: [{ columnName: 'lineId', groupingEnabled: true }]
  }], []);

  const GroupingRow = ({ row, ...restProps }: any) => {
    if (!row?.groupingValue) return null;
    
    const line = lines?.find((line: any) => line.id === row.groupingValue);
    const text = line?.name || (row.groupingValue === 'unassigned' ? 'Unassigned' : 'Unknown');
    return (
      <div className="bg-gray-100 p-2 border-b border-gray-200">
        <strong className="text-gray-700">{text}</strong>
      </div>
    );
  };

  const updateWorkOrderMutation = useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: any }) => {
      const response = await api.put(`/api/work-orders/${id}`, changes);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    },
  });

  const optimizeScheduleMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/work-orders/optimize');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      setIsOptimizing(false);
    },
  });

  const commitChanges = async (changes: any) => {
    if (changes.changed) {
      const id = Object.keys(changes.changed)[0];
      const changedData = changes.changed[id];
      
      const workOrderChanges = {
        startDate: changedData.startDate,
        lineId: changedData.lineId === 'unassigned' ? null : changedData.lineId,
      };

      await updateWorkOrderMutation.mutate({ id, changes: workOrderChanges });
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    await optimizeScheduleMutation.mutateAsync();
  };

  if (isLinesLoading || isWorkOrdersLoading) {
    return (
      <div className="flex items-center justify-center h-[700px]">
        <div className="text-lg text-gray-600">Loading schedule...</div>
      </div>
    );
  }

  if (!resources.length) {
    return (
      <div className="flex items-center justify-center h-[700px]">
        <div className="text-lg text-gray-600">No production lines available</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Production Schedule</h1>
        <Button
          variant="contained"
          color="primary"
          onClick={handleOptimize}
          disabled={isOptimizing}
          startIcon={
            <ArrowPathIcon className={`h-5 w-5 ${isOptimizing ? 'animate-spin' : ''}`} />
          }
        >
          {isOptimizing ? 'Optimizing...' : 'Optimize Schedule'}
        </Button>
      </div>

      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => {
          queryClient.invalidateQueries({ queryKey: ['workOrders'] });
          queryClient.invalidateQueries({ queryKey: ['lines'] });
        }}
      >
        <Paper>
          <Scheduler
            data={appointments}
            height={700}
          >
            <ViewState
              currentDate={currentDate}
              onCurrentDateChange={setCurrentDate}
              currentViewName={currentViewName}
              onCurrentViewNameChange={setCurrentViewName}
            />
            <GroupingState
              grouping={[{ resourceName: 'lineId' }]}
            />
            <EditingState
              onCommitChanges={commitChanges}
            />
            <WeekView
              startDayHour={0}
              endDayHour={24}
              cellDuration={60}
              intervalCount={1}
            />
            <Appointments
              appointmentContentComponent={AppointmentContent}
            />
            <Resources
              data={resources}
              mainResourceName="lineId"
            />
            <IntegratedGrouping />
            <IntegratedEditing />
            <GroupingPanel />
            <Toolbar />
            <DateNavigator />
            <TodayButton />
            <ViewSwitcher />
            <AppointmentTooltip
              showCloseButton
              showOpenButton
            />
            <AppointmentForm />
            <DragDropProvider />
            <ConfirmationDialog />
          </Scheduler>
        </Paper>
      </ErrorBoundary>
    </div>
  );
};

const TimeScaleLayout = ({ ...restProps }) => (
  <WeekView.TimeScaleLayout
    {...restProps}
    className="border-r border-gray-200"
  />
);

export default Schedule; 