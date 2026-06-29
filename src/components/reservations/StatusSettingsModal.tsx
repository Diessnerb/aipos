import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Save, X, RotateCcw } from 'lucide-react';
import { Reservation } from '@/types/reservation';
import { useStatusConfig } from '@/contexts/StatusConfigContext';

interface StatusConfig {
  label: string;
  color: string;
}

interface StatusSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}


const colorOptions = [
  { name: 'Green', value: 'bg-green-500 text-white border-green-500' },
  { name: 'Blue', value: 'bg-blue-500 text-white border-blue-500' },
  { name: 'Red', value: 'bg-red-500 text-white border-red-500' },
  { name: 'Orange', value: 'bg-orange-500 text-white border-orange-500' },
  { name: 'Yellow', value: 'bg-yellow-500 text-white border-yellow-500' },
  { name: 'Purple', value: 'bg-purple-500 text-white border-purple-500' },
  { name: 'Pink', value: 'bg-pink-500 text-white border-pink-500' },
  { name: 'Fuchsia', value: 'bg-fuchsia-500 text-white border-fuchsia-500' },
  { name: 'Gray', value: 'bg-gray-600 text-white border-gray-600' },
  { name: 'Slate', value: 'bg-slate-500 text-white border-slate-500' },
];

export const StatusSettingsModal: React.FC<StatusSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { statusConfig, updateStatusConfig, resetToDefaults } = useStatusConfig();
  const [localStatusConfig, setLocalStatusConfig] = useState(statusConfig);
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [newStatusKey, setNewStatusKey] = useState('');
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState(colorOptions[0].value);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Update local state when context changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalStatusConfig(statusConfig);
    }
  }, [statusConfig, isOpen]);

  const handleEditStatus = (statusKey: string) => {
    setEditingStatus(statusKey);
  };

  const handleSaveEdit = (statusKey: string, newLabel: string, newColor: string) => {
    setLocalStatusConfig(prev => ({
      ...prev,
      [statusKey]: { label: newLabel, color: newColor }
    }));
    setEditingStatus(null);
  };

  const handleAddNewStatus = () => {
    if (newStatusKey && newStatusLabel) {
      setLocalStatusConfig(prev => ({
        ...prev,
        [newStatusKey]: { label: newStatusLabel, color: newStatusColor }
      }));
      setNewStatusKey('');
      setNewStatusLabel('');
      setNewStatusColor(colorOptions[0].value);
      setIsAddingNew(false);
    }
  };

  const handleResetToDefaults = () => {
    resetToDefaults();
    setEditingStatus(null);
  };

  const handleSaveChanges = () => {
    updateStatusConfig(localStatusConfig);
    onClose();
  };

  const handleCancel = () => {
    setLocalStatusConfig(statusConfig);
    setEditingStatus(null);
    setIsAddingNew(false);
    onClose();
  };

  const StatusRow: React.FC<{ statusKey: string; config: StatusConfig }> = ({ statusKey, config }) => {
    const [editLabel, setEditLabel] = useState(config.label);
    const [editColor, setEditColor] = useState(config.color);

    if (editingStatus === statusKey) {
      return (
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3 flex-1">
            <div className="max-w-xs px-3 py-2 bg-gray-100 border rounded-md text-gray-700">
              {config.label}
            </div>
            <select
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              {colorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.name}
                </option>
              ))}
            </select>
            <Badge className={editColor}>
              Preview
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleSaveEdit(statusKey, config.label, editColor)}
              className="h-8 w-8 p-0"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditingStatus(null)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div className="flex items-center gap-3">
          <Badge className={`${config.color} font-medium`}>
            {config.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEditStatus(statusKey)}
            className="h-8 w-8 p-0"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const statusEntries = Object.entries(localStatusConfig);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reservation Status Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleResetToDefaults}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                title="Reset to defaults"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>


          {/* All Statuses */}
          <div className="space-y-2">
            {statusEntries.map(([statusKey, config]) => (
              <StatusRow key={statusKey} statusKey={statusKey} config={config} />
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveChanges}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
