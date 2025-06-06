import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  ArrowPathIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentListIcon,
  ExclamationCircleIcon,
  ClockIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { Dialog } from '@headlessui/react';
import api, { useAuthInterceptor } from '../config/axios';

interface Material {
  partNumber: string;
  quantity: number;
  available: number;
  reference?: string;
}

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
  materialStatus: 'pending' | 'partial' | 'complete' | 'missing';
  materialList?: Material[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
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
  notes?: string;
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
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
}

export default function WorkOrders() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isMaterialOpen, setIsMaterialOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [materialFilter, setMaterialFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [editMode, setEditMode] = useState(false);

  const toggleClearToBuildMutation = useMutation({
    mutationFn: (id: string) =>
      api.put(`/api/work-orders/${id}/clear-to-build`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    },
  });

  // Set up auth interceptor
  useAuthInterceptor();

  const { data: workOrders, isLoading } = useQuery<WorkOrder[]>({
    queryKey: ['workOrders', materialFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (materialFilter !== 'all') params.append('materialStatus', materialFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      
      const { data } = await api.get('/api/work-orders?' + params.toString());
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (newWorkOrder: WorkOrderFormData) =>
      api.post('/api/work-orders', newWorkOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      setIsOpen(false);
    },
  });

  const updateMaterialListMutation = useMutation({
    mutationFn: ({ id, materialList }: { id: string; materialList: Material[] }) =>
      api.put(`/api/work-orders/${id}/material-list`, { materialList }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      setIsMaterialOpen(false);
      setSelectedWorkOrder(null);
    },
  });

  const updateMaterialAvailabilityMutation = useMutation({
    mutationFn: ({ id, partNumber, available }: { id: string; partNumber: string; available: number }) =>
      api.put(`/api/work-orders/${id}/material-availability`, { partNumber, available }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/api/work-orders/upload', formData, {
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
    mutationFn: () => api.post('/api/work-orders/optimize'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    },
  });

  const updateWorkOrderMutation = useMutation({
    mutationFn: (workOrder: Partial<WorkOrder> & { id: string }) =>
      api.put(`/api/work-orders/${workOrder.id}`, workOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      setIsOpen(false);
      setSelectedWorkOrder(null);
      setEditMode(false);
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
      priority: formData.get('priority') as WorkOrderFormData['priority'],
      notes: formData.get('notes') as string,
    };

    if (editMode && selectedWorkOrder) {
      await updateWorkOrderMutation.mutate({
        id: selectedWorkOrder.id,
        ...data,
      });
    } else {
      await createMutation.mutate(data);
    }
  };

  const handleMaterialSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedWorkOrder) return;

    const formData = new FormData(e.currentTarget);
    const materials: Material[] = [];
    
    // Get all material entries from the form
    let i = 0;
    while (formData.get(`partNumber${i}`)) {
      materials.push({
        partNumber: formData.get(`partNumber${i}`) as string,
        quantity: parseInt(formData.get(`quantity${i}`) as string),
        available: parseInt(formData.get(`available${i}`) as string),
        reference: formData.get(`reference${i}`) as string,
      });
      i++;
    }

    await updateMaterialListMutation.mutate({
      id: selectedWorkOrder.id,
      materialList: materials,
    });
  };

  const handleFileUpload = async () => {
    if (selectedFile) {
      await uploadMutation.mutate(selectedFile);
    }
  };

  const getMaterialStatusIcon = (status: WorkOrder['materialStatus']) => {
    switch (status) {
      case 'complete':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'partial':
        return <ClockIcon className="h-5 w-5 text-orange-500" />;
      case 'missing':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ExclamationCircleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: WorkOrder['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-700 bg-red-50';
      case 'high':
        return 'text-orange-700 bg-orange-50';
      case 'medium':
        return 'text-yellow-700 bg-yellow-50';
      default:
        return 'text-green-700 bg-green-50';
    }
  };

  const handleEdit = (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder);
    setEditMode(true);
    setIsOpen(true);
  };

  const handleToggleClearToBuild = async (workOrder: WorkOrder) => {
    await toggleClearToBuildMutation.mutate(workOrder.id);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded mb-8"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Work Orders</h1>
        <div className="flex flex-wrap gap-3">
          <select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
            className="select-field"
          >
            <option value="all">All Materials</option>
            <option value="complete">Complete</option>
            <option value="partial">Partial</option>
            <option value="missing">Missing</option>
            <option value="pending">Pending</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="select-field"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
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

      <div className="space-y-4 mb-8">
        {workOrders?.map((wo) => (
          <div key={wo.id} className="card">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h3 className="text-lg font-medium text-gray-900">WO #{wo.woId}</h3>
                  <span className={`flex items-center text-sm px-2 py-1 rounded-full ${getPriorityColor(wo.priority)}`}>
                    {wo.priority.charAt(0).toUpperCase() + wo.priority.slice(1)}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedWorkOrder(wo);
                      setIsMaterialOpen(true);
                    }}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-900"
                  >
                    {getMaterialStatusIcon(wo.materialStatus)}
                    <span className="ml-1">
                      {wo.materialStatus.charAt(0).toUpperCase() + wo.materialStatus.slice(1)}
                    </span>
                  </button>
                  <button
                    onClick={() => handleEdit(wo)}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-900"
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleClearToBuild(wo)}
                    className={`flex items-center text-sm px-2 py-1 rounded ${
                      wo.clearToBuild
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {wo.clearToBuild ? 'Clear to Build' : 'Not Clear'}
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  {wo.numberOfAssemblies} assemblies · {wo.numberOfParts} parts ·{' '}
                  {wo.numberOfPlacements} placements
                  {wo.isDoubleSided && ' · Double Sided'}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Due: {new Date(wo.dueDate).toLocaleDateString()}
                  {wo.line && ` · Line: ${wo.line.name}`}
                </div>
                {wo.notes && (
                  <div className="text-sm text-gray-600 mt-2 break-words">{wo.notes}</div>
                )}
              </div>
              <div className="flex items-start">
                {wo.materialList && wo.materialList.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedWorkOrder(wo);
                      setIsMaterialOpen(true);
                    }}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap"
                  >
                    <ClipboardDocumentListIcon className="h-5 w-5 mr-1" />
                    View Materials
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Work Order Form Dialog */}
      <Dialog
        open={isOpen}
        onClose={() => {
          setIsOpen(false);
          setSelectedWorkOrder(null);
          setEditMode(false);
        }}
        className="fixed inset-0 z-10 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-lg w-full mx-4">
            <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
              {editMode ? 'Edit Work Order' : 'Add Work Order'}
            </Dialog.Title>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="woId" className="block text-sm font-medium text-gray-700">
                  Work Order ID
                </label>
                <input
                  type="text"
                  name="woId"
                  id="woId"
                  required
                  readOnly={editMode}
                  defaultValue={selectedWorkOrder?.woId}
                  className="mt-1 input-field"
                />
              </div>

              <div>
                <label htmlFor="numberOfAssemblies" className="block text-sm font-medium text-gray-700">
                  Number of Assemblies
                </label>
                <input
                  type="number"
                  name="numberOfAssemblies"
                  id="numberOfAssemblies"
                  required
                  min="1"
                  defaultValue={selectedWorkOrder?.numberOfAssemblies}
                  className="mt-1 input-field"
                />
              </div>

              <div>
                <label htmlFor="assemblyCycleTime" className="block text-sm font-medium text-gray-700">
                  Assembly Cycle Time (minutes)
                </label>
                <input
                  type="number"
                  name="assemblyCycleTime"
                  id="assemblyCycleTime"
                  required
                  min="0"
                  step="0.1"
                  defaultValue={selectedWorkOrder?.assemblyCycleTime}
                  className="mt-1 input-field"
                />
              </div>

              <div>
                <label htmlFor="numberOfParts" className="block text-sm font-medium text-gray-700">
                  Number of Parts
                </label>
                <input
                  type="number"
                  name="numberOfParts"
                  id="numberOfParts"
                  required
                  min="1"
                  defaultValue={selectedWorkOrder?.numberOfParts}
                  className="mt-1 input-field"
                />
              </div>

              <div>
                <label htmlFor="numberOfPlacements" className="block text-sm font-medium text-gray-700">
                  Number of Placements
                </label>
                <input
                  type="number"
                  name="numberOfPlacements"
                  id="numberOfPlacements"
                  required
                  min="1"
                  defaultValue={selectedWorkOrder?.numberOfPlacements}
                  className="mt-1 input-field"
                />
              </div>

              <div>
                <label htmlFor="isDoubleSided" className="block text-sm font-medium text-gray-700">
                  Double Sided
                </label>
                <select
                  name="isDoubleSided"
                  id="isDoubleSided"
                  required
                  defaultValue={selectedWorkOrder?.isDoubleSided ? 'true' : 'false'}
                  className="mt-1 select-field"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>

              <div>
                <label htmlFor="materialAvailableDate" className="block text-sm font-medium text-gray-700">
                  Material Available Date
                </label>
                <input
                  type="date"
                  name="materialAvailableDate"
                  id="materialAvailableDate"
                  required
                  defaultValue={selectedWorkOrder?.materialAvailableDate?.split('T')[0]}
                  className="mt-1 input-field"
                />
              </div>

              <div>
                <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">
                  Due Date
                </label>
                <input
                  type="date"
                  name="dueDate"
                  id="dueDate"
                  required
                  defaultValue={selectedWorkOrder?.dueDate?.split('T')[0]}
                  className="mt-1 input-field"
                />
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                  Priority
                </label>
                <select
                  name="priority"
                  id="priority"
                  required
                  defaultValue={selectedWorkOrder?.priority}
                  className="mt-1 select-field"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  name="notes"
                  id="notes"
                  rows={3}
                  defaultValue={selectedWorkOrder?.notes}
                  className="mt-1 input-field"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setSelectedWorkOrder(null);
                    setEditMode(false);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editMode ? 'Save Changes' : 'Create Work Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>

      {/* Material List Dialog */}
      <Dialog
        open={isMaterialOpen}
        onClose={() => {
          setIsMaterialOpen(false);
          setSelectedWorkOrder(null);
        }}
        className="fixed inset-0 z-10 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-lg w-full mx-4">
            <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
              Material Shortages - WO #{selectedWorkOrder?.woId}
            </Dialog.Title>

            <form onSubmit={handleMaterialSubmit} className="space-y-4">
              {selectedWorkOrder?.materialList?.map((material, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label
                        htmlFor={`partNumber${index}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Part Number
                      </label>
                      <input
                        type="text"
                        name={`partNumber${index}`}
                        id={`partNumber${index}`}
                        required
                        defaultValue={material.partNumber}
                        className="mt-1 input-field"
                      />
                    </div>
                    <div className="w-24">
                      <label
                        htmlFor={`quantity${index}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Quantity
                      </label>
                      <input
                        type="number"
                        name={`quantity${index}`}
                        id={`quantity${index}`}
                        required
                        min="1"
                        defaultValue={material.quantity}
                        className="mt-1 input-field"
                      />
                    </div>
                    <div className="w-24">
                      <label
                        htmlFor={`available${index}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Available
                      </label>
                      <input
                        type="number"
                        name={`available${index}`}
                        id={`available${index}`}
                        required
                        min="0"
                        defaultValue={material.available}
                        className="mt-1 input-field"
                      />
                    </div>
                    <div className="flex-1">
                      <label
                        htmlFor={`reference${index}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Reference
                      </label>
                      <input
                        type="text"
                        name={`reference${index}`}
                        id={`reference${index}`}
                        defaultValue={material.reference}
                        className="mt-1 input-field"
                      />
                    </div>
                  </div>
                  {material.available < material.quantity && (
                    <div className="text-sm text-red-600">
                      Shortage: {material.quantity - material.available} units
                    </div>
                  )}
                </div>
              ))}

              {(!selectedWorkOrder?.materialList ||
                selectedWorkOrder.materialList.length === 0) && (
                <div className="text-sm text-green-600">
                  No material shortages for this work order.
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsMaterialOpen(false);
                    setSelectedWorkOrder(null);
                  }}
                  className="btn-secondary"
                >
                  Close
                </button>
                {selectedWorkOrder?.materialList &&
                  selectedWorkOrder.materialList.length > 0 && (
                    <button type="submit" className="btn-primary">
                      Update Materials
                    </button>
                  )}
              </div>
            </form>
          </div>
        </div>
      </Dialog>

      {/* File Upload Dialog */}
      <Dialog
        open={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setSelectedFile(null);
        }}
        className="fixed inset-0 z-10 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-lg p-8 max-w-lg w-full mx-4">
            <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
              Import Work Orders
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Upload CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
              </div>

              <div className="flex justify-end gap-3">
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
                  className={`btn-primary ${!selectedFile && 'opacity-50 cursor-not-allowed'}`}
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
} 