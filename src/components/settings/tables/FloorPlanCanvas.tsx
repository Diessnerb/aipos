import { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, Rect, Circle, FabricObject, Line, Text, Group } from 'fabric';
import { Table } from '@/types/table';
import { getCanvasThemeColors } from '@/utils/themeColors';

interface FloorPlanCanvasProps {
  tables: Table[];
  onTableSelect?: (table: Table | null) => void;
  onTableMove?: (tableId: string, x: number, y: number, rotation?: number) => void;
  selectedTool: string;
  onAddTable?: (x: number, y: number, shape: string) => void;
  gridVisible?: boolean;
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export const FloorPlanCanvas = ({
  tables,
  onTableSelect,
  onTableMove,
  selectedTool,
  onAddTable,
  gridVisible = true,
  zoom = 1,
  onZoomIn,
  onZoomOut
}: FloorPlanCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [tableObjects, setTableObjects] = useState<Map<string, FabricObject>>(new Map());
  const [gridObjects, setGridObjects] = useState<FabricObject[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#ffffff',
      selection: true,
    });

    addGridToCanvas(canvas);
    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, []);

  // Handle zoom changes
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.setZoom(zoom);
    fabricCanvas.renderAll();
  }, [fabricCanvas, zoom]);

  // Handle grid visibility
  useEffect(() => {
    if (!fabricCanvas) return;
    gridObjects.forEach(obj => {
      obj.visible = gridVisible;
    });
    fabricCanvas.renderAll();
  }, [fabricCanvas, gridVisible, gridObjects]);

  // Handle canvas events
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleObjectMoving = (e: any) => {
      setIsDragging(true);
      const obj = e.target;
      if (obj && (obj as any).tableId) {
        setDraggingTableId((obj as any).tableId);
      }
    };

    const handleObjectModified = (e: any) => {
      const obj = e.target;
      if (obj && (obj as any).tableId && onTableMove) {
        onTableMove((obj as any).tableId, obj.left, obj.top, obj.angle);
      }
      
      // Clear drag state after a brief delay to allow state updates
      setTimeout(() => {
        setIsDragging(false);
        setDraggingTableId(null);
      }, 50);
    };

    const handleSelection = (e: any) => {
      if (e.selected && e.selected.length > 0) {
        const obj = e.selected[0];
        if ((obj as any).tableId) {
          const table = tables.find(t => t.id === (obj as any).tableId);
          onTableSelect?.(table || null);
        }
      } else {
        onTableSelect?.(null);
      }
    };

    const handleCanvasClick = (e: any) => {
      // Only allow table creation if we're not in select mode and didn't click on an object
      if (selectedTool === 'select' || e.target) {
        return;
      }

      const pointer = fabricCanvas.getPointer(e.e);
      
      // Handle different tool types
      if (selectedTool.includes('table') || selectedTool === 'booth' || selectedTool === 'high-table') {
        onAddTable?.(pointer.x, pointer.y, selectedTool);
      } else if (selectedTool.includes('chair') || selectedTool.includes('stool') || selectedTool.includes('bench')) {
        // For now, chairs are treated as tables until we implement separate chair objects
        onAddTable?.(pointer.x, pointer.y, selectedTool);
      }
    };

    fabricCanvas.on('object:moving', handleObjectMoving);
    fabricCanvas.on('object:modified', handleObjectModified);
    fabricCanvas.on('selection:created', handleSelection);
    fabricCanvas.on('selection:updated', handleSelection);
    fabricCanvas.on('selection:cleared', handleSelection);
    fabricCanvas.on('mouse:up', handleCanvasClick);

    return () => {
      fabricCanvas.off('object:moving', handleObjectMoving);
      fabricCanvas.off('object:modified', handleObjectModified);
      fabricCanvas.off('selection:created', handleSelection);
      fabricCanvas.off('selection:updated', handleSelection);
      fabricCanvas.off('selection:cleared', handleSelection);
      fabricCanvas.off('mouse:up', handleCanvasClick);
    };
  }, [fabricCanvas, selectedTool, onTableSelect, onTableMove, onAddTable, tables]);

  // Synchronize canvas objects with tables prop
  useEffect(() => {
    if (!fabricCanvas) return;

    const newTableObjects = new Map<string, FabricObject>();
    const currentTableIds = new Set(tables.map(t => t.id));
    
    // Remove objects that are no longer in tables array
    tableObjects.forEach((obj, tableId) => {
      if (!currentTableIds.has(tableId)) {
        fabricCanvas.remove(obj);
      }
    });

    // Clear all objects if no tables
    if (tables.length === 0) {
      tableObjects.forEach(obj => fabricCanvas.remove(obj));
      setTableObjects(newTableObjects);
      fabricCanvas.renderAll();
      return;
    }

    // Add or update table objects
    tables.forEach((table, index) => {
      const existingObj = tableObjects.get(table.id);
      
      if (existingObj) {
        // Don't update position if this table is currently being dragged
        if (!isDragging || draggingTableId !== table.id) {
          existingObj.set({
            left: table.floor_plan_x ?? (150 + (index % 6) * 100),
            top: table.floor_plan_y ?? (150 + Math.floor(index / 6) * 100),
            angle: table.floor_plan_rotation ?? 0
          });
        }
        newTableObjects.set(table.id, existingObj);
      } else {
        // Create new object
        const tableObj = createTableObject(table, index);
        if (tableObj) {
          (tableObj as any).tableId = table.id;
          // Apply rotation if specified
          if (table.floor_plan_rotation) {
            tableObj.set({ angle: table.floor_plan_rotation });
          }
          fabricCanvas.add(tableObj);
          newTableObjects.set(table.id, tableObj);
        }
      }
    });
    
    setTableObjects(newTableObjects);
    fabricCanvas.renderAll();
  }, [tables, fabricCanvas]);

  const addGridToCanvas = (canvas: FabricCanvas) => {
    const gridSize = 20;
    const colors = getCanvasThemeColors();
    const newGridObjects: FabricObject[] = [];
    
    for (let i = 0; i < canvas.width! / gridSize; i++) {
      const line = new Line([i * gridSize, 0, i * gridSize, canvas.height!], {
        stroke: colors.border,
        strokeWidth: 1,
        selectable: false,
        evented: false,
        opacity: 0.3,
      });
      canvas.add(line);
      newGridObjects.push(line);
    }

    for (let i = 0; i < canvas.height! / gridSize; i++) {
      const line = new Line([0, i * gridSize, canvas.width!, i * gridSize], {
        stroke: colors.border,
        strokeWidth: 1,
        selectable: false,
        evented: false,
        opacity: 0.3,
      });
      canvas.add(line);
      newGridObjects.push(line);
    }
    
    setGridObjects(newGridObjects);
  };

  const createTableObject = (table: Table, index: number = 0): FabricObject | null => {
    const colors = getCanvasThemeColors();
    const x = table.floor_plan_x ?? (150 + (index % 6) * 100);
    const y = table.floor_plan_y ?? (150 + Math.floor(index / 6) * 100);
    
    // Normalize shape and type for comparison
    const normalizedShape = table.shape?.toLowerCase() || 'round';
    const tableType = table.type?.toLowerCase() || 'standard';
    
    // Size variations based on seat count and type
    const seatCount = table.seats || 4;
    const baseSize = Math.min(Math.max(20 + seatCount * 3, 25), 45);
    
    // Color coding for special features
    let fillColor = colors.background;
    let strokeColor = colors.border;
    let strokeWidth = 2;
    
    // VIP status - golden border
    if (table.vip_status) {
      strokeColor = '#ffd700';
      strokeWidth = 3;
    }
    
    // Accessibility - blue border
    if (table.accessibility_friendly) {
      strokeColor = '#3b82f6';
      strokeWidth = 3;
    }
    
    // Window seating - light blue fill
    if (table.window_seating) {
      fillColor = '#e0f2fe';
    }
    
    // High top - darker fill
    if (table.is_high_top) {
      fillColor = '#f5f5f5';
      strokeWidth = 3;
    }
    
    let tableObj: FabricObject;
    
    // Handle different shapes (case insensitive)
    if (normalizedShape === 'round' || normalizedShape === 'circle') {
      tableObj = new Circle({
        radius: baseSize,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
      });
    } else if (normalizedShape === 'rectangle' || normalizedShape === 'square') {
      // Adjust dimensions based on table type
      let width = baseSize * 2;
      let height = baseSize * 2;
      
      if (tableType.includes('tall')) {
        width = baseSize * 1.5;
        height = baseSize * 2.5;
      }
      
      tableObj = new Rect({
        width: width,
        height: height,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
      });
    } else {
      // Default to circle for unknown shapes
      tableObj = new Circle({
        radius: baseSize,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
      });
    }
    
    // Handle different table types with specific visual styles
    if (tableType.includes('sofa')) {
      // Sofas - rounded rectangle with softer appearance
      if (tableObj instanceof Rect) {
        tableObj.set({
          rx: 15,
          ry: 15,
          fill: '#fef7cd', // Warm cream color for sofas
        });
      }
    } else if (tableType.includes('bucket')) {
      // Bucket chairs - smaller circles with unique styling
      if (tableObj instanceof Circle) {
        tableObj.set({
          radius: Math.max(baseSize * 0.7, 20),
          fill: '#f0f9ff', // Light blue for bucket chairs
          stroke: '#0ea5e9',
        });
      }
    }
    
    // Create table number text
    const text = new Text(table.table_number.toString(), {
      fontSize: Math.min(Math.max(10 + seatCount, 12), 16),
      fill: colors.foreground,
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      fontWeight: table.vip_status ? 'bold' : 'normal',
    });
    
    const tableElements: FabricObject[] = [tableObj, text];
    
    // Add feature indicators
    if (table.accessibility_friendly) {
      const accessIcon = new Text('♿', {
        fontSize: 12,
        fill: '#3b82f6',
        left: x + baseSize * 0.7,
        top: y - baseSize * 0.7,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
      });
      tableElements.push(accessIcon);
    }
    
    if (table.window_seating) {
      const windowIcon = new Text('🪟', {
        fontSize: 10,
        left: x - baseSize * 0.7,
        top: y - baseSize * 0.7,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
      });
      tableElements.push(windowIcon);
    }
    
    if (table.vip_status) {
      const vipIcon = new Text('⭐', {
        fontSize: 12,
        left: x + baseSize * 0.7,
        top: y + baseSize * 0.7,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
      });
      tableElements.push(vipIcon);
    }
    
    if (table.is_high_top) {
      const highTopIndicator = new Text('H', {
        fontSize: 8,
        fill: '#6b7280',
        fontWeight: 'bold',
        left: x - baseSize * 0.7,
        top: y + baseSize * 0.7,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
      });
      tableElements.push(highTopIndicator);
    }
    
    return new Group(tableElements, {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      angle: table.floor_plan_rotation ?? 0,
    });
  };

  return (
    <div className="relative border border-border rounded-lg overflow-hidden bg-background">
      <canvas ref={canvasRef} />
    </div>
  );
};