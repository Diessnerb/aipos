import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  MousePointer2, Square, Circle, RectangleHorizontal, Armchair,
  Coffee, Minus, Building, DoorOpen, Mountain, Utensils,
  ZoomIn, ZoomOut, Grid3X3, Save, Upload, RotateCw,
  Ruler, Layers, Route, Accessibility, Zap, Navigation,
  TreePine, Briefcase, Wrench, Package, Building2
} from 'lucide-react';

interface CategorizedFloorPlanToolbarProps {
  selectedTool: string;
  onToolSelect: (tool: string) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onToggleGrid?: () => void;
  onSave?: () => void;
  onLoad?: () => void;
  onRotateSelected?: () => void;
  gridVisible?: boolean;
}

export const CategorizedFloorPlanToolbar: React.FC<CategorizedFloorPlanToolbarProps> = ({
  selectedTool,
  onToolSelect,
  onZoomIn,
  onZoomOut,
  onToggleGrid,
  onSave,
  onLoad,
  onRotateSelected,
  gridVisible = true
}) => {
  const [activeTab, setActiveTab] = useState('seating');

  const seatingTools = [
    { id: 'select', icon: MousePointer2, label: 'Select & Move' },
    { id: 'round-table', icon: Circle, label: 'Round Table' },
    { id: 'square-table', icon: Square, label: 'Square Table' },
    { id: 'booth', icon: RectangleHorizontal, label: 'Booth' },
    { id: 'high-table', icon: Square, label: 'High Table' },
  ];

  const chairTools = [
    { id: 'standard-chair', icon: Armchair, label: 'Standard Chair' },
    { id: 'bar-stool', icon: Coffee, label: 'Bar Stool' },
    { id: 'waiting-bench', icon: Armchair, label: 'Waiting Bench' },
    { id: 'outdoor-chair', icon: TreePine, label: 'Outdoor Chair' },
  ];

  const architectureTools = [
    { id: 'wall', icon: Building, label: 'Wall' },
    { id: 'door', icon: DoorOpen, label: 'Door' },
    { id: 'window', icon: Mountain, label: 'Window' },
    { id: 'column', icon: Building2, label: 'Column' },
    { id: 'kitchen-area', icon: Utensils, label: 'Kitchen Area' },
    { id: 'restroom', icon: Navigation, label: 'Restroom' },
  ];

  const furnitureTools = [
    { id: 'bar', icon: Minus, label: 'Bar Counter' },
    { id: 'host-stand', icon: Briefcase, label: 'Host Stand' },
    { id: 'service-station', icon: Wrench, label: 'Service Station' },
    { id: 'storage', icon: Package, label: 'Storage Area' },
  ];

  const utilityTools = [
    { id: 'measure', icon: Ruler, label: 'Measure Tool' },
    { id: 'traffic-flow', icon: Route, label: 'Traffic Flow' },
    { id: 'accessibility-path', icon: Accessibility, label: 'Accessibility Path' },
    { id: 'emergency-exit', icon: Zap, label: 'Emergency Exit' },
    { id: 'layer', icon: Layers, label: 'Layer Manager' },
  ];

  const renderToolGroup = (tools: typeof seatingTools, groupName: string) => (
    <div className="grid grid-cols-5 gap-1">
      {tools.map(tool => (
        <Button
          key={tool.id}
          variant={selectedTool === tool.id ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onToolSelect(tool.id)}
          className="h-12 w-12 flex flex-col items-center justify-center p-1"
          title={tool.label}
        >
          <tool.icon className="h-4 w-4 mb-1" />
          <span className="text-xs leading-none">{tool.label.split(' ')[0]}</span>
        </Button>
      ))}
    </div>
  );

  const getSelectedToolCount = (category: string) => {
    const toolGroups = {
      seating: seatingTools,
      chairs: chairTools,
      architecture: architectureTools,
      furniture: furnitureTools,
      utilities: utilityTools
    };
    
    const tools = toolGroups[category as keyof typeof toolGroups] || [];
    return tools.some(tool => tool.id === selectedTool) ? 1 : 0;
  };

  return (
    <div className="bg-muted/30 border-b border-border">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between px-4 py-2">
          <TabsList className="grid w-auto grid-cols-5">
            <TabsTrigger value="seating" className="relative">
              Seating
              {getSelectedToolCount('seating') > 0 && (
                <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
                  1
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="chairs" className="relative">
              Chairs
              {getSelectedToolCount('chairs') > 0 && (
                <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
                  1
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="architecture" className="relative">
              Architecture
              {getSelectedToolCount('architecture') > 0 && (
                <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
                  1
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="furniture" className="relative">
              Furniture
              {getSelectedToolCount('furniture') > 0 && (
                <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
                  1
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="utilities" className="relative">
              Utilities
              {getSelectedToolCount('utilities') > 0 && (
                <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
                  1
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Quick Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRotateSelected}
              className="h-8"
              title="Rotate Selected"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            
            <Separator orientation="vertical" className="h-6" />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomIn}
              className="h-8"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomOut}
              className="h-8"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant={gridVisible ? 'default' : 'ghost'}
              size="sm"
              onClick={onToggleGrid}
              className="h-8"
              title="Toggle Grid"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            
            <Separator orientation="vertical" className="h-6" />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onSave}
              className="h-8"
              title="Save Layout"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoad}
              className="h-8"
              title="Load Layout"
            >
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-4 pb-3">
          <TabsContent value="seating" className="mt-0">
            {renderToolGroup(seatingTools, 'Seating')}
          </TabsContent>
          <TabsContent value="chairs" className="mt-0">
            {renderToolGroup(chairTools, 'Chairs')}
          </TabsContent>
          <TabsContent value="architecture" className="mt-0">
            {renderToolGroup(architectureTools, 'Architecture')}
          </TabsContent>
          <TabsContent value="furniture" className="mt-0">
            {renderToolGroup(furnitureTools, 'Furniture')}
          </TabsContent>
          <TabsContent value="utilities" className="mt-0">
            {renderToolGroup(utilityTools, 'Utilities')}
          </TabsContent>
        </div>

        {/* Tool Description */}
        <div className="px-4 py-2 bg-muted/20 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedTool === 'select' && 'Click to select objects, drag to move'}
            {selectedTool === 'round-table' && 'Click anywhere to add a round table'}
            {selectedTool === 'square-table' && 'Click anywhere to add a square table'}
            {selectedTool === 'booth' && 'Click anywhere to add a booth'}
            {selectedTool === 'high-table' && 'Click anywhere to add a high table'}
            {selectedTool === 'standard-chair' && 'Click anywhere to add a standard chair'}
            {selectedTool === 'bar-stool' && 'Click anywhere to add a bar stool'}
            {selectedTool === 'waiting-bench' && 'Click anywhere to add a waiting bench'}
            {selectedTool === 'outdoor-chair' && 'Click anywhere to add an outdoor chair'}
            {selectedTool === 'wall' && 'Click and drag to draw walls'}
            {selectedTool === 'door' && 'Click anywhere to add a door'}
            {selectedTool === 'window' && 'Click anywhere to add a window'}
            {selectedTool === 'column' && 'Click anywhere to add a column'}
            {selectedTool === 'kitchen-area' && 'Click anywhere to add a kitchen area'}
            {selectedTool === 'restroom' && 'Click anywhere to add a restroom'}
            {selectedTool === 'bar' && 'Click anywhere to add a bar counter'}
            {selectedTool === 'host-stand' && 'Click anywhere to add a host stand'}
            {selectedTool === 'service-station' && 'Click anywhere to add a service station'}
            {selectedTool === 'storage' && 'Click anywhere to add a storage area'}
            {selectedTool === 'measure' && 'Click and drag to measure distances'}
            {selectedTool === 'traffic-flow' && 'Click and drag to draw traffic flow paths'}
            {selectedTool === 'accessibility-path' && 'Click and drag to draw accessibility paths'}
            {selectedTool === 'emergency-exit' && 'Click anywhere to add an emergency exit'}
            {selectedTool === 'layer' && 'Manage object layers and visibility'}
          </p>
        </div>
      </Tabs>
    </div>
  );
};