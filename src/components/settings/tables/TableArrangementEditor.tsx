import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Table, TableArrangement, ConnectionPoint, SeatPosition } from '@/types/table';
import { SpareSeatStorage } from './SpareSeatStorage';
import { 
  Move, RotateCw, ZoomIn, ZoomOut, Save, RefreshCw, Plus, Minus, Users, 
  AlertTriangle, Undo2, Redo2, Grid3X3, Eye, EyeOff, Settings, Package,
  Archive, Trash2, Link, Unlink
} from 'lucide-react';
import { toast } from 'sonner';
import { getCanvasThemeColors } from '@/utils/themeColors';

interface TableArrangementEditorProps {
  tables: Table[];
  selectedTableIds: string[];
  onArrangementChange: (arrangements: TableArrangement[]) => void;
  onConnectionPointsChange: (points: ConnectionPoint[]) => void;
  onSave?: (arrangement: any, seatData: any) => Promise<any>;
}

// History management for undo/redo
interface HistoryState {
  arrangements: TableArrangement[];
  seatPositions: Record<string, SeatPosition[]>;
  connectionPoints: ConnectionPoint[];
}

export const TableArrangementEditor = ({
  tables,
  selectedTableIds,
  onArrangementChange,
  onConnectionPointsChange,
  onSave
}: TableArrangementEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [arrangements, setArrangements] = useState<TableArrangement[]>([]);
  const [connectionPoints, setConnectionPoints] = useState<ConnectionPoint[]>([]);
  const [tableSeatPositions, setTableSeatPositions] = useState<Record<string, SeatPosition[]>>({});
  const [spareSeats, setSpareSeats] = useState<SeatPosition[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<{ tableId: string; seatIndex: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragType, setDragType] = useState<'table' | 'seat'>('table');
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 600 });
  const [modalSize, setModalSize] = useState({ width: 0, height: 0 });
  const [showConnectionPoints, setShowConnectionPoints] = useState(true);
  const [showSeats, setShowSeats] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [joinMode, setJoinMode] = useState(false);
  
  // History management
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Scroll lock during drag
  const [scrollLocked, setScrollLocked] = useState(false);
  
  // Responsive canvas sizing
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const spareSeatSidebarWidth = 280; // Approximate sidebar width
        const padding = 40;
        
        const availableWidth = Math.min(900, rect.width - spareSeatSidebarWidth - padding);
        const availableHeight = Math.min(600, rect.height - 120); // Account for controls
        
        setCanvasSize({
          width: Math.max(400, availableWidth),
          height: Math.max(300, availableHeight)
        });
        setModalSize({ width: rect.width, height: rect.height });
      }
    };

    updateCanvasSize();
    
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateCanvasSize);
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);
  
  // Zoom boundary management
  const handleZoomChange = (newZoom: number) => {
    const maxZoom = Math.min(3, modalSize.width / 400); // Prevent overflow
    const minZoom = 0.5;
    setZoom(Math.max(minZoom, Math.min(maxZoom, newZoom)));
  };
  
  const [capacityStats, setCapacityStats] = useState<{
    totalSeats: number;
    lostSeats: number;
    spareSeats: number;
    efficiency: number;
  }>({ totalSeats: 0, lostSeats: 0, spareSeats: 0, efficiency: 100 });

  const selectedTables = tables.filter(table => selectedTableIds.includes(table.id));

  // Enhanced scroll lock during drag operations
  useEffect(() => {
    if (scrollLocked) {
      document.body.style.overflow = 'hidden';
      
      // Lock all parent scroll containers
      let parent = containerRef.current?.parentElement;
      while (parent && parent !== document.body) {
        parent.style.overflow = 'hidden';
        parent.style.pointerEvents = isDragging ? 'none' : '';
        parent = parent.parentElement;
      }
      
      // Prevent modal content scrolling
      const modalContent = containerRef.current?.closest('[role="dialog"]');
      if (modalContent) {
        (modalContent as HTMLElement).style.overflow = 'hidden';
      }
    } else {
      document.body.style.overflow = '';
      
      // Restore parent scroll containers
      let parent = containerRef.current?.parentElement;
      while (parent && parent !== document.body) {
        parent.style.overflow = '';
        parent.style.pointerEvents = '';
        parent = parent.parentElement;
      }
      
      // Restore modal content scrolling
      const modalContent = containerRef.current?.closest('[role="dialog"]');
      if (modalContent) {
        (modalContent as HTMLElement).style.overflow = '';
      }
    }
    
    return () => {
      document.body.style.overflow = '';
      let parent = containerRef.current?.parentElement;
      while (parent && parent !== document.body) {
        parent.style.overflow = '';
        parent.style.pointerEvents = '';
        parent = parent.parentElement;
      }
    };
  }, [scrollLocked, isDragging]);

  // Save current state to history
  const saveToHistory = () => {
    const newState: HistoryState = {
      arrangements: [...arrangements],
      seatPositions: JSON.parse(JSON.stringify(tableSeatPositions)),
      connectionPoints: [...connectionPoints]
    };
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    
    // Limit history to 50 states
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      setHistoryIndex(historyIndex + 1);
    }
    
    setHistory(newHistory);
  };

  // Undo/Redo functions
  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setArrangements(prevState.arrangements);
      setTableSeatPositions(prevState.seatPositions);
      setConnectionPoints(prevState.connectionPoints);
      setHistoryIndex(historyIndex - 1);
      
      onArrangementChange(prevState.arrangements);
      onConnectionPointsChange(prevState.connectionPoints);
      toast.success('Undone');
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setArrangements(nextState.arrangements);
      setTableSeatPositions(nextState.seatPositions);
      setConnectionPoints(nextState.connectionPoints);
      setHistoryIndex(historyIndex + 1);
      
      onArrangementChange(nextState.arrangements);
      onConnectionPointsChange(nextState.connectionPoints);
      toast.success('Redone');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.key === 'z' && e.shiftKey || e.key === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  useEffect(() => {
    if (selectedTables.length > 0 && arrangements.length === 0) {
      initializeArrangements();
    }
  }, [selectedTables]);

  useEffect(() => {
    if (arrangements.length > 0 && Object.keys(tableSeatPositions).length === 0) {
      initializeSeatPositions();
    }
  }, [arrangements]);

  useEffect(() => {
    calculateCapacityStats();
  }, [arrangements, tableSeatPositions, connectionPoints, spareSeats]);

  useEffect(() => {
    drawCanvas();
  }, [arrangements, connectionPoints, tableSeatPositions, selectedTable, selectedSeat, zoom, showConnectionPoints, showSeats, showGrid, dragPreview]);

  const initializeArrangements = () => {
    const newArrangements: TableArrangement[] = [];
    const spacing = 150;
    const startX = 100;
    const startY = canvasSize.height / 2;

    selectedTables.forEach((table, index) => {
      newArrangements.push({
        table_id: table.id,
        x_position: startX + (index * spacing),
        y_position: startY,
        rotation: 0,
        scale: 1,
      });
    });

    setArrangements(newArrangements);
    onArrangementChange(newArrangements);
    saveToHistory();
  };

  const generateRectangularSeatLayout = (table: Table, arrangement: TableArrangement): SeatPosition[] => {
    const seats: SeatPosition[] = [];
    const seatCount = table.seats || 4;
    const tableWidth = 80;
    const tableHeight = 50;
    const seatRadius = 15;
    const seatSpacing = Math.max(30, (tableWidth + tableHeight) / seatCount);
    
    // Calculate perimeter positions for rectangular tables
    const perimeter = 2 * (tableWidth + tableHeight);
    const seatDistance = perimeter / seatCount;
    
    for (let i = 0; i < seatCount; i++) {
      let x, y;
      const position = i * seatDistance;
      
      if (position < tableWidth) {
        // Top edge
        x = arrangement.x_position - tableWidth/2 + position;
        y = arrangement.y_position - tableHeight/2 - seatRadius - 5;
      } else if (position < tableWidth + tableHeight) {
        // Right edge
        x = arrangement.x_position + tableWidth/2 + seatRadius + 5;
        y = arrangement.y_position - tableHeight/2 + (position - tableWidth);
      } else if (position < 2 * tableWidth + tableHeight) {
        // Bottom edge
        x = arrangement.x_position + tableWidth/2 - (position - tableWidth - tableHeight);
        y = arrangement.y_position + tableHeight/2 + seatRadius + 5;
      } else {
        // Left edge
        x = arrangement.x_position - tableWidth/2 - seatRadius - 5;
        y = arrangement.y_position + tableHeight/2 - (position - 2 * tableWidth - tableHeight);
      }
      
      seats.push({
        id: `${table.id}-seat-${i}`,
        table_id: table.id,
        company_id: table.company_id,
        seat_number: i + 1,
        x_position: x,
        y_position: y,
        seat_type: 'standard',
        seat_status: 'available',
        is_accessible: table.accessibility_friendly && i === 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    
    return seats;
  };

  const initializeSeatPositions = () => {
    const newSeatPositions: Record<string, SeatPosition[]> = {};
    
    selectedTables.forEach(table => {
      const arrangement = arrangements.find(arr => arr.table_id === table.id);
      
      if (!arrangement) return;
      
      const seatCount = table.seats || 4;
      
      // Use rectangular layout for rectangular tables, circular for round tables
      if (table.shape === 'circle') {
        const seats: SeatPosition[] = [];
        const radius = 50;
        
        for (let i = 0; i < seatCount; i++) {
          const angle = (i / seatCount) * 2 * Math.PI;
          
          seats.push({
            id: `${table.id}-seat-${i}`,
            table_id: table.id,
            company_id: table.company_id,
            seat_number: i + 1,
            x_position: arrangement.x_position + radius * Math.cos(angle),
            y_position: arrangement.y_position + radius * Math.sin(angle),
            seat_type: 'standard',
            seat_status: 'available',
            is_accessible: table.accessibility_friendly && i === 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        
        newSeatPositions[table.id] = seats;
      } else {
        // Use perimeter-based rectangular layout
        newSeatPositions[table.id] = generateRectangularSeatLayout(table, arrangement);
      }
    });
    
    setTableSeatPositions(newSeatPositions);
  };

  const snapCoordinate = (coord: number) => {
    if (!snapToGrid) return coord;
    const gridSize = 20;
    return Math.round(coord / gridSize) * gridSize;
  };

  const calculateCapacityStats = () => {
    const totalSeats = Object.values(tableSeatPositions).reduce(
      (sum, seats) => sum + seats.filter(s => s.seat_status === 'available').length, 0
    );
    
    const lostSeats = Object.values(tableSeatPositions).reduce(
      (sum, seats) => sum + seats.filter(s => s.seat_status === 'lost').length, 0
    );
    
    const actualTotalSeats = Object.values(tableSeatPositions).reduce(
      (sum, seats) => sum + seats.length, 0
    );
    
    const efficiency = actualTotalSeats > 0 ? (totalSeats / actualTotalSeats * 100) : 100;
    
    setCapacityStats({
      totalSeats,
      lostSeats,
      spareSeats: spareSeats.length,
      efficiency: Math.round(efficiency)
    });
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get resolved theme colors
    const colors = getCanvasThemeColors();

    // Clear canvas
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw grid if enabled
    if (showGrid) {
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 0.5;
      const gridSize = 20;
      
      for (let x = 0; x < canvasSize.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasSize.height);
        ctx.stroke();
      }
      
      for (let y = 0; y < canvasSize.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasSize.width, y);
        ctx.stroke();
      }
    }

    // Draw connection lines
    if (showConnectionPoints) {
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      connectionPoints.forEach(point => {
        const connectedPoint = connectionPoints.find(p => 
          p.connected_to === point.table_id && point.connected_to === p.table_id
        );
        
        if (connectedPoint) {
          ctx.beginPath();
          ctx.moveTo(point.x * zoom, point.y * zoom);
          ctx.lineTo(connectedPoint.x * zoom, connectedPoint.y * zoom);
          ctx.stroke();
        }
      });
      
      ctx.setLineDash([]);
    }

    // Draw tables
    arrangements.forEach(arrangement => {
      const table = selectedTables.find(t => t.id === arrangement.table_id);
      if (!table) return;

      const isSelected = selectedTable === table.id;
      
      ctx.save();
      ctx.translate(arrangement.x_position * zoom, arrangement.y_position * zoom);
      ctx.rotate((arrangement.rotation * Math.PI) / 180);
      ctx.scale(arrangement.scale * zoom, arrangement.scale * zoom);

      // Table shape
      const width = 80;
      const height = 50;
      
      ctx.fillStyle = isSelected ? colors.primary : colors.muted;
      ctx.strokeStyle = isSelected ? colors.primaryForeground : colors.border;
      ctx.lineWidth = isSelected ? 3 : 1;

      if (table.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, width / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.strokeRect(-width / 2, -height / 2, width, height);
      }

      // Table label
      ctx.fillStyle = isSelected ? colors.primaryForeground : colors.foreground;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`T${table.table_number}`, 0, -10);
      const seatCount = tableSeatPositions[table.id]?.filter(s => s.seat_status === 'available').length || table.seats;
      ctx.fillText(`${seatCount} seats`, 0, 5);

      ctx.restore();
    });

    // Draw seats if enabled
    if (showSeats) {
      Object.entries(tableSeatPositions).forEach(([tableId, seats]) => {
        seats.forEach((seat, seatIndex) => {
          if (seat.seat_status === 'spare') return; // Don't draw spare seats on canvas
          
          const isSelected = selectedSeat?.tableId === tableId && selectedSeat?.seatIndex === seatIndex;
          const isAccessible = seat.is_accessible;
          const isLost = seat.seat_status === 'lost';
          const isBlocked = seat.seat_status === 'blocked';
          const isDraggingSeat = isDragging && dragType === 'seat' && isSelected;
          
          // Use drag preview position if dragging this seat, otherwise use stored position
          const seatX = isDraggingSeat && dragPreview ? dragPreview.x : seat.x_position;
          const seatY = isDraggingSeat && dragPreview ? dragPreview.y : seat.y_position;
          
          // Determine seat color
          let seatColor = colors.secondary;
          if (isSelected) seatColor = colors.primary;
          else if (isLost) seatColor = '#ef4444'; // red for lost seats
          else if (isBlocked) seatColor = '#f97316'; // orange for blocked
          else if (isAccessible) seatColor = '#f59e0b'; // amber for accessible
          
          ctx.strokeStyle = colors.border;
          ctx.lineWidth = isSelected ? 2 : 1;
          
          // Add transparency if dragging, lost, or blocked
          if (isDraggingSeat || isLost || isBlocked) {
            ctx.globalAlpha = isLost || isBlocked ? 0.5 : 0.7;
          }
          
          ctx.fillStyle = seatColor;
          ctx.beginPath();
          ctx.arc(seatX * zoom, seatY * zoom, 8 * zoom, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          
          // Add X for lost/blocked seats
          if (isLost || isBlocked) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 * zoom;
            const x = seatX * zoom;
            const y = seatY * zoom;
            const size = 6 * zoom;
            ctx.beginPath();
            ctx.moveTo(x - size, y - size);
            ctx.lineTo(x + size, y + size);
            ctx.moveTo(x + size, y - size);
            ctx.lineTo(x - size, y + size);
            ctx.stroke();
          }
          
          // Seat number (if available)
          if (seat.seat_status === 'available') {
            ctx.fillStyle = isSelected ? colors.primaryForeground : colors.foreground;
            ctx.font = `${10 * zoom}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(
              seat.seat_number.toString(), 
              seatX * zoom, 
              seatY * zoom + 3 * zoom
            );
          }
          
          // Reset alpha
          ctx.globalAlpha = 1;
        });
      });
    }

    // Draw connection points
    if (showConnectionPoints) {
      connectionPoints.forEach(point => {
        const isConnected = connectionPoints.some(p => 
          p.connected_to === point.table_id && point.connected_to === p.table_id
        );
        
        ctx.fillStyle = isConnected ? colors.primary : colors.mutedForeground;
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.arc(point.x * zoom, point.y * zoom, 4 * zoom, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      });
    }
  };

  const getCanvasCoordinates = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / zoom,
      y: (event.clientY - rect.top) / zoom
    };
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return; // Don't process clicks during drag
    
    const coords = getCanvasCoordinates(event);

    // Check if clicked on a seat first (higher priority)
    let clickedSeat: { tableId: string; seatIndex: number } | null = null;
    
    if (showSeats) {
      Object.entries(tableSeatPositions).forEach(([tableId, seats]) => {
        seats.forEach((seat, seatIndex) => {
          if (seat.seat_status === 'spare') return; // Skip spare seats
          
          const distance = Math.sqrt(
            Math.pow(coords.x - seat.x_position, 2) + 
            Math.pow(coords.y - seat.y_position, 2)
          );
          
          if (distance <= 12) {
            clickedSeat = { tableId, seatIndex };
          }
        });
      });
    }

    if (clickedSeat) {
      setSelectedSeat(clickedSeat);
      setSelectedTable(null);
      setDragType('seat');
      return;
    }

    // Check if clicked on a table
    const clickedTable = arrangements.find(arrangement => {
      const table = selectedTables.find(t => t.id === arrangement.table_id);
      if (!table) return false;

      const distance = Math.sqrt(
        Math.pow(coords.x - arrangement.x_position, 2) + 
        Math.pow(coords.y - arrangement.y_position, 2)
      );
      
      return distance <= 50 * arrangement.scale;
    });

    if (clickedTable) {
      setSelectedTable(clickedTable.table_id);
      setSelectedSeat(null);
      setDragType('table');
    } else {
      setSelectedTable(null);
      setSelectedSeat(null);
    }
  };

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(event);
    
    if (selectedTable || selectedSeat) {
      setIsDragging(true);
      setScrollLocked(true); // Lock scrolling during drag
      setDragPreview(null);
      
      // Calculate drag offset
      if (selectedTable) {
        const arrangement = arrangements.find(arr => arr.table_id === selectedTable);
        if (arrangement) {
          setDragOffset({
            x: coords.x - arrangement.x_position,
            y: coords.y - arrangement.y_position
          });
        }
      } else if (selectedSeat) {
        const seat = tableSeatPositions[selectedSeat.tableId]?.[selectedSeat.seatIndex];
        if (seat && seat.seat_status !== 'spare') {
          setDragOffset({
            x: coords.x - seat.x_position,
            y: coords.y - seat.y_position
          });
        }
      }
      
      // Prevent default to stop scrolling
      event.preventDefault();
    }
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    
    const coords = getCanvasCoordinates(event);
    const newX = snapCoordinate(coords.x - dragOffset.x);
    const newY = snapCoordinate(coords.y - dragOffset.y);
    
    // Constrain to canvas bounds
    const constrainedX = Math.max(40, Math.min(canvasSize.width - 40, newX));
    const constrainedY = Math.max(30, Math.min(canvasSize.height - 30, newY));
    
    if (dragType === 'table' && selectedTable) {
      const updatedArrangements = arrangements.map(arr => 
        arr.table_id === selectedTable
          ? { ...arr, x_position: constrainedX, y_position: constrainedY }
          : arr
      );
      
      setArrangements(updatedArrangements);
      onArrangementChange(updatedArrangements);
      
      // Update seat positions relative to table
      updateSeatsForTable(selectedTable, constrainedX, constrainedY);
    } else if (dragType === 'seat' && selectedSeat) {
      setDragPreview({ x: constrainedX, y: constrainedY });
    }
    
    event.preventDefault();
  };

  const handleCanvasMouseUp = () => {
    if (isDragging && dragType === 'seat' && selectedSeat && dragPreview) {
      // Commit seat position
      const updatedPositions = { ...tableSeatPositions };
      const seats = [...updatedPositions[selectedSeat.tableId]];
      seats[selectedSeat.seatIndex] = {
        ...seats[selectedSeat.seatIndex],
        x_position: dragPreview.x,
        y_position: dragPreview.y
      };
      updatedPositions[selectedSeat.tableId] = seats;
      setTableSeatPositions(updatedPositions);
    }
    
    setIsDragging(false);
    setScrollLocked(false); // Unlock scrolling
    setDragPreview(null);
    
    if (isDragging) {
      saveToHistory();
    }
  };

  const updateSeatsForTable = (tableId: string, newX: number, newY: number) => {
    const arrangement = arrangements.find(arr => arr.table_id === tableId);
    const table = selectedTables.find(t => t.id === tableId);
    
    if (!arrangement || !table || !tableSeatPositions[tableId]) return;
    
    const deltaX = newX - arrangement.x_position;
    const deltaY = newY - arrangement.y_position;
    
    const updatedPositions = { ...tableSeatPositions };
    const seats = tableSeatPositions[tableId].map(seat => ({
      ...seat,
      x_position: seat.x_position + deltaX,
      y_position: seat.y_position + deltaY
    }));
    
    updatedPositions[tableId] = seats;
    setTableSeatPositions(updatedPositions);
  };

  // Seat context menu actions
  const handleSeatStatusChange = (status: 'available' | 'lost' | 'blocked' | 'spare') => {
    if (!selectedSeat) return;
    
    const updatedPositions = { ...tableSeatPositions };
    const seats = [...updatedPositions[selectedSeat.tableId]];
    const seat = seats[selectedSeat.seatIndex];
    
    if (status === 'spare') {
      // Move to spare storage
      const spareSeat = {
        ...seat,
        seat_status: 'spare' as const,
        spare_reason: 'manually_blocked' as const,
        original_table_id: selectedSeat.tableId,
        removal_timestamp: new Date().toISOString()
      };
      
      setSpareSeats(prev => [...prev, spareSeat]);
      seats.splice(selectedSeat.seatIndex, 1); // Remove from table
      toast.success('Seat moved to spare storage');
    } else {
      seats[selectedSeat.seatIndex] = {
        ...seat,
        seat_status: status
      };
      
      const statusLabels = {
        available: 'Available',
        lost: 'Lost',
        blocked: 'Blocked'
      };
      toast.success(`Seat marked as ${statusLabels[status]}`);
    }
    
    updatedPositions[selectedSeat.tableId] = seats;
    setTableSeatPositions(updatedPositions);
    saveToHistory();
  };

  const handleRestoreSpareSeat = (seatId: string) => {
    const spareSeat = spareSeats.find(s => s.id === seatId);
    if (!spareSeat || !spareSeat.original_table_id) return;
    
    // Add back to original table
    const updatedPositions = { ...tableSeatPositions };
    if (updatedPositions[spareSeat.original_table_id]) {
      const restoredSeat = {
        ...spareSeat,
        seat_status: 'available' as const,
        spare_reason: undefined,
        original_table_id: undefined,
        removal_timestamp: undefined
      };
      
      updatedPositions[spareSeat.original_table_id].push(restoredSeat);
      setTableSeatPositions(updatedPositions);
    }
    
    // Remove from spare storage
    setSpareSeats(prev => prev.filter(s => s.id !== seatId));
    saveToHistory();
  };

  const handleDeleteSpareSeat = (seatId: string) => {
    setSpareSeats(prev => prev.filter(s => s.id !== seatId));
  };

  const handleClearAllSpares = () => {
    setSpareSeats([]);
    toast.success('All spare seats cleared');
  };

  // Auto-arrange tables
  const autoArrange = () => {
    const newArrangements: TableArrangement[] = [];
    const spacing = 180;
    const cols = Math.ceil(Math.sqrt(selectedTables.length));
    const startX = 120;
    const startY = 120;
    
    selectedTables.forEach((table, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      newArrangements.push({
        table_id: table.id,
        x_position: startX + (col * spacing),
        y_position: startY + (row * spacing),
        rotation: 0,
        scale: 1,
      });
    });
    
    setArrangements(newArrangements);
    onArrangementChange(newArrangements);
    
    // Regenerate seat positions for new arrangement
    initializeSeatPositions();
    saveToHistory();
    toast.success('Tables auto-arranged');
  };

  const handleSaveArrangement = async () => {
    if (!onSave) return;
    
    try {
      const arrangementData = {
        arrangements,
        connection_points: connectionPoints,
        updated_at: new Date().toISOString()
      };
      
      const seatData = {
        tableSeatPositions,
        spareSeats
      };
      
      await onSave(arrangementData, seatData);
      toast.success('Arrangement saved successfully');
    } catch (error) {
      console.error('Failed to save arrangement:', error);
      toast.error('Failed to save arrangement');
    }
  };

  return (
    <div ref={containerRef} className="h-full flex gap-4 overflow-hidden">
      {/* Main arrangement area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Stats and controls */}
        <div className="flex-shrink-0 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {capacityStats.totalSeats} Available
              </Badge>
              {capacityStats.lostSeats > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {capacityStats.lostSeats} Lost
                </Badge>
              )}
              {capacityStats.spareSeats > 0 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  {capacityStats.spareSeats} Spare
                </Badge>
              )}
              <Badge variant="outline">
                {capacityStats.efficiency}% Efficient
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={historyIndex <= 0}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={autoArrange}
              >
                <RefreshCw className="h-4 w-4" />
                Auto-Arrange
              </Button>
              {onSave && (
                <Button onClick={handleSaveArrangement}>
                  <Save className="h-4 w-4" />
                  Save Layout
                </Button>
              )}
            </div>
          </div>

          {/* View controls */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Zoom:</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleZoomChange(zoom - 0.1)}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-mono min-w-[4ch] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleZoomChange(zoom + 0.1)}
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleZoomChange(1)}
                title="Zoom to fit"
              >
                Fit
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={showGrid}
                  onCheckedChange={setShowGrid}
                  id="show-grid"
                />
                <Label htmlFor="show-grid" className="text-sm">Grid</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={showSeats}
                  onCheckedChange={setShowSeats}
                  id="show-seats"
                />
                <Label htmlFor="show-seats" className="text-sm">Seats</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={showConnectionPoints}
                  onCheckedChange={setShowConnectionPoints}
                  id="show-connections"
                />
                <Label htmlFor="show-connections" className="text-sm">Connections</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={snapToGrid}
                  onCheckedChange={setSnapToGrid}
                  id="snap-to-grid"
                />
                <Label htmlFor="snap-to-grid" className="text-sm">Snap</Label>
              </div>
            </div>
          </div>
        </div>

        {/* Canvas area */}
        <Card className="flex-1 min-h-0">
          <CardContent className="p-4 h-full">
            <div className="border rounded-lg bg-background h-full flex items-center justify-center overflow-auto">
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    onClick={handleCanvasClick}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    className="cursor-pointer"
                    style={{ 
                      imageRendering: 'crisp-edges',
                      transform: `scale(${zoom})`,
                      transformOrigin: 'top left'
                    }}
                  />
                </ContextMenuTrigger>
                <ContextMenuContent>
                  {selectedSeat && (
                    <>
                      <ContextMenuItem onClick={() => handleSeatStatusChange('available')}>
                        Mark Available
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleSeatStatusChange('lost')}>
                        Mark Lost
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleSeatStatusChange('blocked')}>
                        Mark Blocked
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleSeatStatusChange('spare')}>
                        Move to Spare Storage
                      </ContextMenuItem>
                    </>
                  )}
                  {selectedTable && (
                    <>
                      <ContextMenuItem onClick={() => setSelectedTable(null)}>
                        Deselect Table
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spare Seat Storage Sidebar */}
      {spareSeats.length > 0 && (
        <div className="w-80 flex-shrink-0">
          <SpareSeatStorage
            spareSeats={spareSeats}
            onRestoreSeat={handleRestoreSpareSeat}
            onDeleteSeat={handleDeleteSpareSeat}
            onClearAllSpares={handleClearAllSpares}
          />
        </div>
      )}
    </div>
  );
};