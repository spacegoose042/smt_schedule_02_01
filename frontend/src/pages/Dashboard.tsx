import { useQuery } from '@tanstack/react-query';
import { ArrowTrendingUpIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

interface DashboardStats {
  totalWorkOrders: number;
  scheduledWorkOrders: number;
  unscheduledWorkOrders: number;
  activeLines: number;
  totalLines: number;
  upcomingDeadlines: Array<{
    id: string;
    woId: string;
    dueDate: string;
    isLate: boolean;
  }>;
  lineUtilization: Array<{
    lineId: string;
    name: string;
    utilization: number;
  }>;
}

export default function Dashboard() {
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const { data } = await axios.get('/api/dashboard/stats');
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded mb-8"></div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading dashboard</h3>
            <div className="mt-2 text-sm text-red-700">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Work Orders Card */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Work Orders</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.totalWorkOrders}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Scheduled</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.scheduledWorkOrders}</p>
            </div>
          </div>
        </div>

        {/* Line Status Card */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-2">SMT Lines</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.activeLines}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.totalLines}</p>
            </div>
          </div>
        </div>

        {/* Average Utilization Card */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Line Utilization</h2>
          <div className="space-y-3">
            {stats?.lineUtilization.map((line) => (
              <div key={line.lineId} className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{line.name}</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-900">{line.utilization}%</span>
                  <ArrowTrendingUpIcon
                    className={`h-4 w-4 ml-1 ${
                      line.utilization > 80 ? 'text-green-500' : 'text-yellow-500'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div className="card">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Upcoming Deadlines</h2>
        <div className="space-y-4">
          {stats?.upcomingDeadlines.map((wo) => (
            <div
              key={wo.id}
              className={`flex items-center justify-between p-3 rounded-md ${
                wo.isLate ? 'bg-red-50' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center">
                <ClockIcon
                  className={`h-5 w-5 mr-2 ${wo.isLate ? 'text-red-500' : 'text-gray-400'}`}
                />
                <span className="text-sm font-medium text-gray-900">WO #{wo.woId}</span>
              </div>
              <span
                className={`text-sm ${
                  wo.isLate ? 'text-red-700 font-medium' : 'text-gray-500'
                }`}
              >
                Due {new Date(wo.dueDate).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 