import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCw, Move, Plus, Minus, Save, RotateCcw, MoreHorizontal } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Table, SeatPosition } from '@/types/table';
import { SpareSeatStorage } from './SpareSeatStorage';
import { getCanvasThemeColors } from '@/utils/themeColors';

interface TableSeatMapperProps {
  table: Table;
  seatPositions: SeatPosition[];
  onSeatPositionsChange: (positions: SeatPosition[]) => void;
  onSave: () => void;
}

export const TableSeatMapper = ({ 
  table, 
  seatPositions, 
  onSeatPositionsChange, 
  onSave 
}: TableSeatMapperProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 300 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [tableShape, setTableShape] = useState<'rectangle' | 'circle'>(
    table.shape as 'rectangle' | 'circle' || 'rectangle'
  );

  // Responsive canvas sizing
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const padding = 40;
        
        // Calculate responsive canvas size based on available space
        const availableWidth = Math.min(500, rect.width - padding);
        const availableHeight = Math.min(400, rect.height - 200); // Account for controls
        
        setCanvasSize({
          width: Math.max(300, availableWidth),
          height: Math.max(250, availableHeight)
        });
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
  
  // Initialize seats if none exist
  useEffect(() => {
    if (seatPositions.length === 0) {
      const newPositions = generateDefaultSeatLayout();
      onSeatPositionsChange(newPositions);
    }
  }, [table.seats, seatPositions.length, onSeatPositionsChange, canvasSize]);

  const generateDefaultSeatLayout = (): SeatPosition[] => {
    const seats: SeatPosition[] = [];
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;
    
    if (tableShape === 'rectangle') {
      // Improved rectangular layout - seats around perimeter
      const tableWidth = 120;
      const tableHeight = 60;
      const seatOffset = 25; // Distance from table edge
      const cornerRadius = 15; // Corner rounding for better positioning
      
      // Calculate perimeter and distribute seats evenly
      const perimeter = 2 * (tableWidth + tableHeight);
      const segmentLength = perimeter / table.seats;
      
      for (let i = 0; i < table.seats; i++) {
        let x, y;
        const position = i * segmentLength;
        
        if (position <= tableWidth) {
          // Top edge
          x = centerX - tableWidth/2 + position;
          y = centerY - tableHeight/2 - seatOffset;
        } else if (position <= tableWidth + tableHeight) {
          // Right edge
          x = centerX + tableWidth/2 + seatOffset;
          y = centerY - tableHeight/2 + (position - tableWidth);
        } else if (position <= 2 * tableWidth + tableHeight) {
          // Bottom edge
          x = centerX + tableWidth/2 - (position - tableWidth - tableHeight);
          y = centerY + tableHeight/2 + seatOffset;
        } else {
          // Left edge
          x = centerX - tableWidth/2 - seatOffset;
          y = centerY + tableHeight/2 - (position - 2 * tableWidth - tableHeight);
        }
        
        seats.push({
          id: `seat-${i}`,
          table_id: table.id,
          company_id: table.company_id,
          seat_number: i + 1,
          x_position: x,
          y_position: y,
          seat_type: 'standard',
          seat_status: 'available',
          is_accessible: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      // Circle layout (unchanged - works well)
      const radius = 80;
      for (let i = 0; i < table.seats; i++) {
        const angle = (i / table.seats) * 2 * Math.PI;
        seats.push({
          id: `seat-${i}`,
          table_id: table.id,
          company_id: table.company_id,
          seat_number: i + 1,
          x_position: centerX + radius * Math.cos(angle),
          y_position: centerY + radius * Math.sin(angle),
          seat_type: 'standard',
          seat_status: 'available',
          is_accessible: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
    
    return seats;
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
    
    // Draw table
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;
    
    ctx.fillStyle = colors.muted;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    
    if (tableShape === 'rectangle') {
      const tableWidth = 120;
      const tableHeight = 60;
      ctx.fillRect(centerX - tableWidth/2, centerY - tableHeight/2, tableWidth, tableHeight);
      ctx.strokeRect(centerX - tableWidth/2, centerY - tableHeight/2, tableWidth, tableHeight);
    } else {
      ctx.beginPath();
      ctx.arc(centerX, centerY, 50, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    
    // Draw table number
    ctx.fillStyle = colors.foreground;
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Table ${table.table_number}`, centerX, centerY + 5);
    
    // Draw seats (skip spare seats)
    seatPositions.forEach((seat, index) => {
      if (seat.seat_status === 'spare') return; // Don't draw spare seats
      
      const isSelected = selectedSeat === index;
      const isAccessible = seat.is_accessible;
      const isLost = seat.seat_status === 'lost';
      const isBlocked = seat.seat_status === 'blocked';
      
      let seatColor = colors.secondary;
      if (isSelected) seatColor = colors.primary;
      else if (isLost) seatColor = '#ef4444'; // red for lost
      else if (isBlocked) seatColor = '#f97316'; // orange for blocked
      else if (isAccessible) seatColor = colors.destructive;
      
      ctx.fillStyle = seatColor;
      
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = isSelected ? 3 : 1;
      
      ctx.beginPath();
      ctx.arc(seat.x_position, seat.y_position, 12, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Add X for lost/blocked seats
      if (isLost || isBlocked) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        const size = 6;
        ctx.beginPath();
        ctx.moveTo(seat.x_position - size, seat.y_position - size);
        ctx.lineTo(seat.x_position + size, seat.y_position + size);
        ctx.moveTo(seat.x_position + size, seat.y_position - size);
        ctx.lineTo(seat.x_position - size, seat.y_position + size);
        ctx.stroke();
      }
      
      // Draw seat number (only for available seats)
      if (seat.seat_status === 'available') {
        ctx.fillStyle = isSelected ? colors.primaryForeground : colors.foreground;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(seat.seat_number.toString(), seat.x_position, seat.y_position + 4);
      }
    });
  };

  useEffect(() => {
    drawCanvas();
  }, [seatPositions, selectedSeat, tableShape]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if clicked on a seat
    const clickedSeat = seatPositions.findIndex(seat => {
      const distance = Math.sqrt(
        Math.pow(x - seat.x_position, 2) + Math.pow(y - seat.y_position, 2)
      );
      return distance <= 12;
    });
    
    if (clickedSeat !== -1) {
      setSelectedSeat(clickedSeat);
      const seat = seatPositions[clickedSeat];
      setDragOffset({
        x: x - seat.x_position,
        y: y - seat.y_position
      });
    } else {
      setSelectedSeat(null);
    }
  };

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedSeat !== null) {
      setIsDragging(true);
    }
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || selectedSeat === null) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - dragOffset.x;
    const y = event.clientY - rect.top - dragOffset.y;
    
    // Constrain to canvas bounds
    const constrainedX = Math.max(12, Math.min(canvasSize.width - 12, x));
    const constrainedY = Math.max(12, Math.min(canvasSize.height - 12, y));
    
    const updatedPositions = [...seatPositions];
    updatedPositions[selectedSeat] = {
      ...updatedPositions[selectedSeat],
      x_position: constrainedX,
      y_position: constrainedY,
    };
    
    onSeatPositionsChange(updatedPositions);
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const addSeat = () => {
    const newSeat: SeatPosition = {
      id: `seat-${seatPositions.length}`,
      table_id: table.id,
      company_id: table.company_id,
      seat_number: seatPositions.length + 1,
      x_position: canvasSize.width / 2,
      y_position: canvasSize.height / 2,
      seat_type: 'standard',
      seat_status: 'available',
      is_accessible: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    onSeatPositionsChange([...seatPositions, newSeat]);
  };

  const removeSeat = () => {
    if (seatPositions.length > 1) {
      const updatedPositions = seatPositions.slice(0, -1);
      onSeatPositionsChange(updatedPositions);
      if (selectedSeat === seatPositions.length - 1) {
        setSelectedSeat(null);
      }
    }
  };

  const toggleSeatAccessibility = () => {
    if (selectedSeat === null) return;
    
    const updatedPositions = [...seatPositions];
    updatedPositions[selectedSeat] = {
      ...updatedPositions[selectedSeat],
      is_accessible: !updatedPositions[selectedSeat].is_accessible,
    };
    
    onSeatPositionsChange(updatedPositions);
  };

  const handleSeatStatusChange = (status: 'available' | 'lost' | 'blocked') => {
    if (selectedSeat === null) return;
    
    const updatedPositions = [...seatPositions];
    updatedPositions[selectedSeat] = {
      ...updatedPositions[selectedSeat],
      seat_status: status,
    };
    
    onSeatPositionsChange(updatedPositions);
  };

  const moveToSpareStorage = () => {
    if (selectedSeat === null) return;
    
    const updatedPositions = [...seatPositions];
    const seatToMove = updatedPositions[selectedSeat];
    
    // Mark seat for spare storage
    seatToMove.seat_status = 'spare';
    seatToMove.spare_reason = 'manually_blocked';
    seatToMove.removal_timestamp = new Date().toISOString();
    
    onSeatPositionsChange(updatedPositions);
    setSelectedSeat(null);
  };

  const resetToDefault = () => {
    const newPositions = generateDefaultSeatLayout();
    onSeatPositionsChange(newPositions);
    setSelectedSeat(null);
  };

  // Get spare seats for display
  const spareSeats = seatPositions.filter(seat => seat.seat_status === 'spare');
  const availableSeats = seatPositions.filter(seat => seat.seat_status !== 'spare');

  const restoreSpareSeat = (seatId: string) => {
    const updatedPositions = seatPositions.map(seat => {
      if (seat.id === seatId) {
        return {
          ...seat,
          seat_status: 'available' as const,
          spare_reason: undefined,
          removal_timestamp: undefined
        };
      }
      return seat;
    });
    onSeatPositionsChange(updatedPositions);
  };

  const deleteSpareSeat = (seatId: string) => {
    const updatedPositions = seatPositions.filter(seat => seat.id !== seatId);
    onSeatPositionsChange(updatedPositions);
  };

  return (
    <div ref={containerRef} className="flex gap-4 h-full">
      <div className="flex-1 min-w-0">
        <Card className="h-full flex flex-col">
          <CardHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Visual Seat Mapper - Table {table.table_number}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{availableSeats.length} active</Badge>
                {spareSeats.length > 0 && (
                  <Badge variant="outline">{spareSeats.length} spare</Badge>
                )}
                <Select value={tableShape} onValueChange={(value: 'rectangle' | 'circle') => setTableShape(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rectangle">Rectangle</SelectItem>
                    <SelectItem value="circle">Circle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-shrink-0 mb-4 border border-border rounded-lg p-4 bg-muted/10 flex items-center justify-center">
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
                      className="cursor-pointer border border-border rounded bg-background"
                      style={{ imageRendering: 'crisp-edges' }}
                    />
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {selectedSeat !== null && (
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
                        <ContextMenuItem onClick={toggleSeatAccessibility}>
                          {seatPositions[selectedSeat]?.is_accessible ? 'Make Standard' : 'Make Accessible'}
                        </ContextMenuItem>
                        <ContextMenuItem onClick={moveToSpareStorage} className="text-orange-600">
                          Move to Spare Storage
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              </div>
              
              <div className="flex-shrink-0 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={addSeat}
                      disabled={seatPositions.length >= 20}
                    >
                      <Plus className="h-4 w-4" />
                      Add Seat
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={removeSeat}
                      disabled={seatPositions.length <= 1}
                    >
                      <Minus className="h-4 w-4" />
                      Remove Seat
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={toggleSeatAccessibility}
                      disabled={selectedSeat === null}
                    >
                      <Move className="h-4 w-4" />
                      Toggle Accessible
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={resetToDefault}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </Button>
                    <Button onClick={onSave}>
                      <Save className="h-4 w-4" />
                      Save Layout
                    </Button>
                  </div>
                </div>
              </div>
              
              {selectedSeat !== null && (
                <div className="flex-shrink-0 mb-4 p-3 border border-border rounded-lg bg-muted/50">
                  <p className="text-sm font-medium">
                    Seat {seatPositions[selectedSeat].seat_number} - 
                    {seatPositions[selectedSeat].is_accessible ? ' Accessible' : ' Standard'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click and drag to move • Right-click for more options
                  </p>
                </div>
              )}
              
              <div className="flex-shrink-0 flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-secondary border"></div>
                  <span>Standard Seat</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive border"></div>
                  <span>Accessible Seat</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 border"></div>
                  <span>Lost/Blocked</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spare seats sidebar */}
      {spareSeats.length > 0 && (
        <div className="w-80 flex-shrink-0">
          <SpareSeatStorage
            spareSeats={spareSeats}
            onRestoreSeat={restoreSpareSeat}
            onDeleteSeat={deleteSpareSeat}
            onClearAllSpares={() => {
              const updatedPositions = seatPositions.filter(seat => seat.seat_status !== 'spare');
              onSeatPositionsChange(updatedPositions);
            }}
          />
        </div>
      )}
    </div>
  );
};