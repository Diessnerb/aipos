import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  MousePointer2,
  Square,
  Circle,
  Minus,
  Coffee,
  Move3D,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Save,
  Upload,
  RotateCw,
  RectangleHorizontal,
  Armchair,
  Briefcase,
  Wrench,
  Package,
  Building,
  DoorOpen,
  Mountain,
  TreePine,
  Utensils,
  Navigation,
  Accessibility,
  Route,
  Ruler,
  Layers,
  Zap
} from 'lucide-react';

interface FloorPlanToolbarProps {
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

export const FloorPlanToolbar = ({
  selectedTool,
  onToolSelect,
  onZoomIn,
  onZoomOut,
  onToggleGrid,
  onSave,
  onLoad,
  onRotateSelected,
  gridVisible = true
}: FloorPlanToolbarProps) => {
  const furnitureTools = [
    { id: 'select', icon: MousePointer2, label: 'Select & Move' },
    { id: 'square-table', icon: Square, label: 'Add Square Table' },
    { id: 'round-table', icon: Circle, label: 'Add Round Table' },
    { id: 'bar', icon: Minus, label: 'Add Bar Counter' },
    { id: 'bar-stool', icon: Coffee, label: 'Add Bar Stool' },
    { id: 'booth', icon: RectangleHorizontal, label: 'Add Booth' },
    { id: 'high-table', icon: Square, label: 'Add High Table' },
    { id: 'waiting-bench', icon: Armchair, label: 'Add Waiting Bench' },
    { id: 'host-stand', icon: Briefcase, label: 'Add Host Stand' },
    { id: 'service-station', icon: Wrench, label: 'Add Service Station' },
    { id: 'storage', icon: Package, label: 'Add Storage Area' },
  ];

  const architecturalTools = [
    { id: 'wall', icon: Building, label: 'Draw Wall' },
    { id: 'door', icon: DoorOpen, label: 'Add Door' },
    { id: 'window', icon: Mountain, label: 'Add Window' },
    { id: 'column', icon: Circle, label: 'Add Column' },
    { id: 'kitchen-area', icon: Utensils, label: 'Add Kitchen Area' },
    { id: 'restroom', icon: Navigation, label: 'Add Restroom' },
    { id: 'outdoor-table', icon: TreePine, label: 'Add Outdoor Table' },
  ];

  const advancedTools = [
    { id: 'traffic-flow', icon: Route, label: 'Draw Traffic Flow' },
    { id: 'accessibility-path', icon: Accessibility, label: 'Add Accessibility Path' },
    { id: 'emergency-exit', icon: Zap, label: 'Add Emergency Exit' },
    { id: 'measure', icon: Ruler, label: 'Measure Tool' },
    { id: 'layer', icon: Layers, label: 'Layer Manager' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 border-b border-border">
      {/* Furniture Tools */}
      <div className="flex gap-1">
        {furnitureTools.map(tool => (
          <Button
            key={tool.id}
            variant={selectedTool === tool.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onToolSelect(tool.id)}
            className="h-8"
            title={tool.label}
          >
            <tool.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Architectural Tools */}
      <div className="flex gap-1">
        {architecturalTools.map(tool => (
          <Button
            key={tool.id}
            variant={selectedTool === tool.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onToolSelect(tool.id)}
            className="h-8"
            title={tool.label}
          >
            <tool.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Advanced Tools */}
      <div className="flex gap-1">
        {advancedTools.map(tool => (
          <Button
            key={tool.id}
            variant={selectedTool === tool.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onToolSelect(tool.id)}
            className="h-8"
            title={tool.label}
          >
            <tool.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Transform Tools */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRotateSelected}
          className="h-8"
          title="Rotate Selected"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* View Controls */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onZoomIn?.()}
          className="h-8"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onZoomOut?.()}
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
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Save/Load */}
      <div className="flex gap-1">
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

      <div className="ml-auto text-sm text-muted-foreground">
        {selectedTool === 'select' && 'Click to select objects, drag to move'}
        {selectedTool === 'square-table' && 'Click anywhere to add a square table'}
        {selectedTool === 'round-table' && 'Click anywhere to add a round table'}
        {selectedTool === 'bar' && 'Click anywhere to add a bar counter'}
        {selectedTool === 'bar-stool' && 'Click anywhere to add a bar stool'}
        {selectedTool === 'booth' && 'Click anywhere to add a booth'}
        {selectedTool === 'high-table' && 'Click anywhere to add a high table'}
        {selectedTool === 'waiting-bench' && 'Click anywhere to add a waiting bench'}
        {selectedTool === 'host-stand' && 'Click anywhere to add a host stand'}
        {selectedTool === 'service-station' && 'Click anywhere to add a service station'}
        {selectedTool === 'storage' && 'Click anywhere to add a storage area'}
        {selectedTool === 'wall' && 'Click and drag to draw walls'}
        {selectedTool === 'door' && 'Click anywhere to add a door'}
        {selectedTool === 'window' && 'Click anywhere to add a window'}
        {selectedTool === 'column' && 'Click anywhere to add a column'}
        {selectedTool === 'kitchen-area' && 'Click anywhere to add a kitchen area'}
        {selectedTool === 'restroom' && 'Click anywhere to add a restroom'}
        {selectedTool === 'outdoor-table' && 'Click anywhere to add an outdoor table'}
        {selectedTool === 'traffic-flow' && 'Click and drag to draw traffic flow paths'}
        {selectedTool === 'accessibility-path' && 'Click and drag to draw accessibility paths'}
        {selectedTool === 'emergency-exit' && 'Click anywhere to add an emergency exit'}
        {selectedTool === 'measure' && 'Click and drag to measure distances'}
        {selectedTool === 'layer' && 'Manage object layers and visibility'}
      </div>
    </div>
  );
};