import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Lock, Unlock, Layers, Move, Trash2 } from 'lucide-react';

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
  objectTypes: string[];
  opacity: number;
}

interface FloorPlanLayersProps {
  isOpen: boolean;
  onClose: () => void;
  onLayerToggle: (layerId: string, property: 'visible' | 'locked') => void;
  onLayerCreate: (name: string, objectTypes: string[]) => void;
  onLayerDelete: (layerId: string) => void;
}

const DEFAULT_LAYERS: Layer[] = [
  {
    id: 'furniture',
    name: 'Furniture',
    visible: true,
    locked: false,
    color: '#3b82f6',
    objectTypes: ['table', 'bar', 'bar-stool', 'booth', 'high-table'],
    opacity: 1,
  },
  {
    id: 'architecture',
    name: 'Architecture',
    visible: true,
    locked: false,
    color: '#6b7280',
    objectTypes: ['wall', 'door', 'window', 'column'],
    opacity: 1,
  },
  {
    id: 'areas',
    name: 'Areas',
    visible: true,
    locked: false,
    color: '#10b981',
    objectTypes: ['kitchen-area', 'restroom', 'storage'],
    opacity: 0.8,
  },
  {
    id: 'service',
    name: 'Service',
    visible: true,
    locked: false,
    color: '#f59e0b',
    objectTypes: ['host-stand', 'service-station', 'waiting-bench'],
    opacity: 1,
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    visible: true,
    locked: false,
    color: '#8b5cf6',
    objectTypes: ['accessibility-path', 'emergency-exit'],
    opacity: 0.9,
  },
  {
    id: 'outdoor',
    name: 'Outdoor',
    visible: true,
    locked: false,
    color: '#059669',
    objectTypes: ['outdoor-table'],
    opacity: 1,
  },
];

export const FloorPlanLayers = ({
  isOpen,
  onClose,
  onLayerToggle,
  onLayerCreate,
  onLayerDelete
}: FloorPlanLayersProps) => {
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS);
  const [newLayerName, setNewLayerName] = useState('');

  if (!isOpen) return null;

  const handleToggleLayer = (layerId: string, property: 'visible' | 'locked') => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, [property]: !layer[property] }
        : layer
    ));
    onLayerToggle(layerId, property);
  };

  const handleCreateLayer = () => {
    if (!newLayerName.trim()) return;
    
    const newLayer: Layer = {
      id: newLayerName.toLowerCase().replace(/\s+/g, '-'),
      name: newLayerName,
      visible: true,
      locked: false,
      color: '#3b82f6',
      objectTypes: [],
      opacity: 1,
    };
    
    setLayers(prev => [...prev, newLayer]);
    onLayerCreate(newLayer.name, newLayer.objectTypes);
    setNewLayerName('');
  };

  const handleDeleteLayer = (layerId: string) => {
    if (layers.length <= 1) return; // Prevent deleting the last layer
    setLayers(prev => prev.filter(layer => layer.id !== layerId));
    onLayerDelete(layerId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-background border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Layer Manager
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Layer List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {layers.map((layer) => (
              <div key={layer.id} className="flex items-center justify-between p-2 rounded border border-border bg-muted/20">
                <div className="flex items-center gap-2 flex-1">
                  <div 
                    className="w-3 h-3 rounded-full border border-border" 
                    style={{ backgroundColor: layer.color }}
                  />
                  <span className="text-sm font-medium">{layer.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {layer.objectTypes.length}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleToggleLayer(layer.id, 'visible')}
                    title={layer.visible ? 'Hide layer' : 'Show layer'}
                  >
                    {layer.visible ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-muted-foreground" />
                    )}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleToggleLayer(layer.id, 'locked')}
                    title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                  >
                    {layer.locked ? (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <Unlock className="h-3 w-3" />
                    )}
                  </Button>
                  
                  {layers.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteLayer(layer.id)}
                      title="Delete layer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => layers.forEach(layer => handleToggleLayer(layer.id, 'visible'))}
                className="text-xs"
              >
                Toggle All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allVisible = layers.every(l => l.visible);
                  layers.forEach(layer => {
                    if (allVisible) {
                      if (layer.visible) handleToggleLayer(layer.id, 'visible');
                    } else {
                      if (!layer.visible) handleToggleLayer(layer.id, 'visible');
                    }
                  });
                }}
                className="text-xs"
              >
                {layers.every(l => l.visible) ? 'Hide All' : 'Show All'}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Layer Statistics */}
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Total Layers:</span>
              <span>{layers.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Visible:</span>
              <span>{layers.filter(l => l.visible).length}</span>
            </div>
            <div className="flex justify-between">
              <span>Locked:</span>
              <span>{layers.filter(l => l.locked).length}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};