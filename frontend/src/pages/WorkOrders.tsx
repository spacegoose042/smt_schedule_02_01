import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  PlusIcon,
  ArrowPathIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Dialog } from '@headlessui/react';

interface WorkOrder {
  id: string;
  woId: string;
  numberOfAssemblies: number;
  assemblyCycleTime: number;
  numberOfParts: number;
  numberOfPlacements: number;
  isDoubleSided: boolean;
  materialAvailableDate: string;
  clearToBuild: boolean;
  dueDate: string;
  startDate?: string;
  setupTime: number;
  tearDownTime: number;
  totalJobTime: number;
  line?: {
    id: string;
    name: string;
  };
  isCompleted: boolean;
  completedAt?: string;
}

interface WorkOrderFormData {
  woId: string;
  numberOfAssemblies: number;
  assemblyCycleTime: number;
  numberOfParts: number;
  numberOfPlacements: number;
  isDoubleSided: boolean;
  materialAvailableDate: string;
  dueDate: string;
}

export default function WorkOrders() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: workOrders, isLoading } = useQuery<WorkOrder[]>({
    queryKey: ['workOrders'],
    queryFn: async () => {
      const { data } = await axios.get('/api/work-orders');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (newWorkOrder: WorkOrderFormData) =>
      axios.post('/api/work-orders', newWorkOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      setIsOpen(false);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return axios.post('/api/work-orders/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      setIsUploadOpen(false);
      setSelectedFile(null);
    },
  });

  const optimizeScheduleMutation = useMutation({
    mutationFn: () => axios.post('/api/work-orders/optimize'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      woId: formData.get('woId') as string,
      numberOfAssemblies: parseInt(formData.get('numberOfAssemblies') as string),
      assemblyCycleTime: parseFloat(formData.get('assemblyCycleTime') as string),
      numberOfParts: parseInt(formData.get('numberOfParts') as string),
      numberOfPlacements: parseInt(formData.get('numberOfPlacements') as string),
      isDoubleSided: formData.get('isDoubleSided') === 'true',
      materialAvailableDate: formData.get('materialAvailableDate') as string,
      dueDate: formData.get('dueDate') as string,
    };

    await createMutation.mutate(data);
  };

  const handleFileUpload = async () => {
    if (selectedFile) {
      await uploadMutation.mutate(selectedFile);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded mb-8"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Work Orders</h1>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="btn-secondary flex items-center"
          >
            <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
            Import
          </button>
          <button
            type="button"
            onClick={() => optimizeScheduleMutation.mutate()}
            className="btn-secondary flex items-center"
          >
            <ArrowPathIcon className="h-5 w-5 mr-2" />
            Optimize Schedule
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Work Order
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {workOrders?.map((wo) => (
          <div key={wo.id} className="card">
            <div className="flex justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-medium text-gray-900">WO #{wo.woId}</h3>
                  {wo.clearToBuild ? (
                    <span className="flex items-center text-sm text-green-700 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                      Clear to Build
                    </span>
                  ) : (
                    <span className="flex items-center text-sm text-red-700 bg-red-50 px-2 py-1 rounded-full">
                      <XCircleIcon className="h-4 w-4 mr-1" />
                      Not Clear
                    </span>
                  )}
                  {wo.isCompleted && (
                    <span className="text-sm text-gray-500">
                      Completed: {new Date(wo.completedAt!).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Assemblies</p>
                    <p className="font-medium">{wo.numberOfAssemblies}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Cycle Time</p>
                    <p className="font-medium">{wo.assemblyCycleTime}s</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Parts</p>
                    <p className="font-medium">{wo.numberOfParts}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Placements</p>
                    <p className="font-medium">{wo.numberOfPlacements}</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Due Date</p>
                <p className="font-medium">{new Date(wo.dueDate).toLocaleDateString()}</p>
                {wo.line && (
                  <p className="text-sm text-gray-600 mt-2">
                    Scheduled on {wo.line.name}
                    <br />
                    Start: {new Date(wo.startDate!).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Work Order Dialog */}
      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
              Add New Work Order
            </Dialog.Title>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="woId" className="form-label">
                    Work Order ID
                  </label>
                  <input
                    type="text"
                    name="woId"
                    id="woId"
                    required
                    className="input-field mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="numberOfAssemblies" className="form-label">
                      Number of Assemblies
                    </label>
                    <input
                      type="number"
                      name="numberOfAssemblies"
                      id="numberOfAssemblies"
                      required
                      min="1"
                      className="input-field mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="assemblyCycleTime" className="form-label">
                      Cycle Time (seconds)
                    </label>
                    <input
                      type="number"
                      name="assemblyCycleTime"
                      id="assemblyCycleTime"
                      required
                      step="0.1"
                      min="0"
                      className="input-field mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="numberOfParts" className="form-label">
                      Number of Parts
                    </label>
                    <input
                      type="number"
                      name="numberOfParts"
                      id="numberOfParts"
                      required
                      min="1"
                      className="input-field mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="numberOfPlacements" className="form-label">
                      Number of Placements
                    </label>
                    <input
                      type="number"
                      name="numberOfPlacements"
                      id="numberOfPlacements"
                      required
                      min="1"
                      className="input-field mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Double Sided</label>
                  <div className="mt-1">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="isDoubleSided"
                        value="true"
                        className="form-radio"
                      />
                      <span className="ml-2">Yes</span>
                    </label>
                    <label className="inline-flex items-center ml-6">
                      <input
                        type="radio"
                        name="isDoubleSided"
                        value="false"
                        className="form-radio"
                        defaultChecked
                      />
                      <span className="ml-2">No</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label htmlFor="materialAvailableDate" className="form-label">
                    Material Available Date
                  </label>
                  <input
                    type="date"
                    name="materialAvailableDate"
                    id="materialAvailableDate"
                    required
                    className="input-field mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="dueDate" className="form-label">
                    Due Date
                  </label>
                  <input
                    type="date"
                    name="dueDate"
                    id="dueDate"
                    required
                    className="input-field mt-1"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Work Order
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isUploadOpen} onClose={() => setIsUploadOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
              Import Work Orders
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label className="form-label">Upload File</label>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary-50 file:text-primary-700
                    hover:file:bg-primary-100"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Upload a CSV or Excel file with work order data
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadOpen(false);
                    setSelectedFile(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFileUpload}
                  disabled={!selectedFile}
                  className="btn-primary disabled:opacity-50"
                >
                  Upload
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
} 