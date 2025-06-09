import React from 'react';
import { useDragLayer } from 'react-dnd';

export const DragPreview = () => {
  const { isDragging, item, currentOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    currentOffset: monitor.getSourceClientOffset(),
    isDragging: monitor.isDragging(),
  }));

  if (!isDragging || !currentOffset) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 100,
        left: currentOffset.x,
        top: currentOffset.y,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className="bg-white border-2 border-primary-500 rounded px-2 py-1 shadow-lg">
        <div className="font-medium text-sm">{item.woId}</div>
        <div className="text-xs text-gray-600">
          {item.numberOfAssemblies} units • {Math.round(item.totalJobTime / 60)} hrs
        </div>
      </div>
    </div>
  );
}; 