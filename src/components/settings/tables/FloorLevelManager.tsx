import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Building, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { FloorLevel, floorPlanStorage } from './FloorPlanStorageService';

interface FloorLevelManagerProps {
  currentLevel: FloorLevel;
  onLevelChange: (level: FloorLevel) => void;
}

export const FloorLevelManager: React.FC<FloorLevelManagerProps> = ({
  currentLevel,
  onLevelChange
}) => {
  const [levels, setLevels] = useState<FloorLevel[]>(floorPlanStorage.getLevels());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newLevelName, setNewLevelName] = useState('');

  const handleCreateLevel = () => {
    if (!newLevelName.trim()) {
      toast.error('Please enter a level name');
      return;
    }

    const newLevel = floorPlanStorage.createLevel(newLevelName.trim());
    const updatedLevels = floorPlanStorage.getLevels();
    setLevels(updatedLevels);
    setNewLevelName('');
    setShowCreateDialog(false);
    toast.success(`Created ${newLevel.name}`);
  };

  const handleDeleteLevel = (levelId: string) => {
    if (levels.length <= 1) {
      toast.error('Cannot delete the only remaining level');
      return;
    }

    const levelToDelete = levels.find(l => l.id === levelId);
    if (!levelToDelete) return;

    floorPlanStorage.deleteLevel(levelId);
    const updatedLevels = floorPlanStorage.getLevels();
    setLevels(updatedLevels);

    // Switch to first available level if current level was deleted
    if (currentLevel.id === levelId) {
      onLevelChange(updatedLevels[0]);
    }

    toast.success(`Deleted ${levelToDelete.name}`);
  };

  const handleLevelSelect = (level: FloorLevel) => {
    // Mark current level as inactive and new level as active
    const updatedLevels = levels.map(l => ({
      ...l,
      isActive: l.id === level.id
    }));
    
    floorPlanStorage.saveLevels(updatedLevels);
    setLevels(updatedLevels);
    onLevelChange(level);
    toast.success(`Switched to ${level.name}`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building className="h-4 w-4" />
          Floor Levels
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {levels.map((level) => (
          <div
            key={level.id}
            className={`flex items-center justify-between p-2 rounded border transition-colors cursor-pointer hover:bg-muted/50 ${
              level.id === currentLevel.id ? 'bg-primary/10 border-primary' : 'border-border'
            }`}
            onClick={() => handleLevelSelect(level)}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{level.name}</span>
              {level.id === currentLevel.id && (
                <Badge variant="default" className="text-xs">Active</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLevelSelect(level);
                }}
                className="h-6 w-6 p-0"
              >
                <Eye className="h-3 w-3" />
              </Button>
              {levels.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteLevel(level.id);
                  }}
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-1" />
              Add Level
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Floor Level</DialogTitle>
              <DialogDescription>
                Add a new floor level to organize tables across multiple floors
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="level-name">Level Name</Label>
                <Input
                  id="level-name"
                  value={newLevelName}
                  onChange={(e) => setNewLevelName(e.target.value)}
                  placeholder="e.g., Second Floor, Basement, Patio"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateLevel();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateLevel}>Create Level</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};