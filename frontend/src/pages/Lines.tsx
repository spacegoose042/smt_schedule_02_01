import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { PlusIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { Dialog } from '@headlessui/react';

interface Line {
  id: string;
  name: string;
  status: 'active' | 'down' | 'maintenance';
  feederCapacity: number;
  description?: string;
  lastMaintenanceDate?: string;
}

interface LineFormData {
  name: string;
  feederCapacity: number;
  description?: string;
}

export default function Lines() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<Line | null>(null);

  const { data: lines, isLoading } = useQuery<Line[]>({
    queryKey: ['lines'],
    queryFn: async () => {
      const { data } = await axios.get('/api/lines');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (newLine: LineFormData) => axios.post('/api/lines', newLine),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      setIsOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Line> }) =>
      axios.put(`/api/lines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      setIsOpen(false);
      setEditingLine(null);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Line['status'] }) =>
      axios.put(`/api/lines/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      feederCapacity: parseInt(formData.get('feederCapacity') as string),
      description: formData.get('description') as string,
    };

    if (editingLine) {
      await updateMutation.mutate({ id: editingLine.id, data });
    } else {
      await createMutation.mutate(data);
    }
  };

  const handleStatusChange = async (lineId: string, status: Line['status']) => {
    await updateStatusMutation.mutate({ id: lineId, status });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded mb-8"></div>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">SMT Lines</h1>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="btn-primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Line
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {lines?.map((line) => (
          <div key={line.id} className="card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{line.name}</h3>
                <p className="text-sm text-gray-500">{line.description}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingLine(line);
                  setIsOpen(true);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <PencilSquareIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Feeder Capacity</p>
                <p className="text-lg font-medium text-gray-900">{line.feederCapacity}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Maintenance</p>
                <p className="text-lg font-medium text-gray-900">
                  {line.lastMaintenanceDate
                    ? new Date(line.lastMaintenanceDate).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <select
                value={line.status}
                onChange={(e) => handleStatusChange(line.id, e.target.value as Line['status'])}
                className="input-field text-sm"
              >
                <option value="active">Active</option>
                <option value="down">Down</option>
                <option value="maintenance">Maintenance</option>
              </select>
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  line.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : line.status === 'down'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {line.status.charAt(0).toUpperCase() + line.status.slice(1)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
              {editingLine ? 'Edit Line' : 'Add New Line'}
            </Dialog.Title>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="form-label">
                    Line Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    defaultValue={editingLine?.name}
                    required
                    className="input-field mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="feederCapacity" className="form-label">
                    Feeder Capacity
                  </label>
                  <input
                    type="number"
                    name="feederCapacity"
                    id="feederCapacity"
                    defaultValue={editingLine?.feederCapacity}
                    required
                    min="1"
                    className="input-field mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="form-label">
                    Description
                  </label>
                  <textarea
                    name="description"
                    id="description"
                    defaultValue={editingLine?.description}
                    rows={3}
                    className="input-field mt-1"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setEditingLine(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingLine ? 'Save Changes' : 'Add Line'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
} 