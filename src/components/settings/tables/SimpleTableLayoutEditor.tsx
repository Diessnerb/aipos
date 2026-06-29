import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  RotateCw, 
  Move, 
  ZoomIn, 
  ZoomOut, 
  Grid, 
  Users,
  Settings2,
  ChevronDown
} from 'lucide-react';
import { Table, SeatPosition } from '@/types/table';
import { toast } from 'sonner';

interface SimpleTableLayoutEditorProps {
  tables: Table[];
  groupName: string;
  onSave?: (arrangementData: any) => void;
}

interface TablePosition {
  id: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
}

interface SeatConfig {
  available: number;
  blocked: number;
  lost: number;
}

export const SimpleTableLayoutEditor = ({
  tables,
  groupName,
  onSave
}: SimpleTableLayoutEditorProps) => {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [tablePositions, setTablePositions] = useState<TablePosition[]>([]);
  const [seatConfigs, setSeatConfigs] = useState<{ [tableId: string]: SeatConfig }>({});
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [configuringTable, setConfiguringTable] = useState<Table | null>(null);
  const [seatPositions, setSeatPositions] = useState<Record<string, SeatPosition[]>>({});
  const [isDragging, setIsDragging] = useState(false);

  // Initialize table positions in a grid layout
  useEffect(() => {
    const positions: TablePosition[] = tables.map((table, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      return {
        id: table.id,
        x: 100 + (col * 200),
        y: 100 + (row * 150),
        rotation: 0,
        width: table.shape === 'round' ? 80 : 120,
        height: table.shape === 'round' ? 80 : 60
      };
    });
    setTablePositions(positions);

    // Initialize seat configs
    const configs: { [tableId: string]: SeatConfig } = {};
    tables.forEach(table => {
      configs[table.id] = {
        available: table.seats,
        blocked: 0,
        lost: 0
      };
    });
    setSeatConfigs(configs);
  }, [tables]);

  const getTableById = (id: string) => tables.find(t => t.id === id);

  const handleTableClick = (tableId: string) => {
    setSelectedTableId(selectedTableId === tableId ? null : tableId);
  };

  const rotateTable = (tableId: string) => {
    setTablePositions(prev => 
      prev.map(pos => 
        pos.id === tableId 
          ? { ...pos, rotation: (pos.rotation + 90) % 360 }
          : pos
      )
    );
  };

  const updateSeatConfig = (tableId: string, type: 'available' | 'blocked' | 'lost', value: number) => {
    setSeatConfigs(prev => ({
      ...prev,
      [tableId]: {
        ...prev[tableId],
        [type]: Math.max(0, value)
      }
    }));
  };

  const calculateTotalCapacity = () => {
    const totalAvailable = Object.values(seatConfigs).reduce((sum, config) => sum + config.available, 0);
    const totalBlocked = Object.values(seatConfigs).reduce((sum, config) => sum + config.blocked, 0);
    const totalLost = Object.values(seatConfigs).reduce((sum, config) => sum + config.lost, 0);
    
    return {
      total: totalAvailable,
      blocked: totalBlocked,
      lost: totalLost,
      effective: totalAvailable - totalBlocked - totalLost
    };
  };

  const capacity = calculateTotalCapacity();
  const efficiency = capacity.total > 0 ? Math.round((capacity.effective / capacity.total) * 100) : 0;

  const renderTableShape = (position: TablePosition, table: Table) => {
    const isSelected = selectedTableId === position.id;
    const seatConfig = seatConfigs[position.id] || { available: table.seats, blocked: 0, lost: 0 };
    
    // Generate seat positions based on table shape and type
    const generateSeatPositions = () => {
      const seats = [];
      const totalSeats = seatConfig.available + seatConfig.blocked + seatConfig.lost;
      const seatRadius = 6;
      
      if (table.shape === 'round') {
        const tableRadius = Math.min(position.width, position.height) / 2;
        const seatDistance = tableRadius + seatRadius + 8;
        const centerX = position.width / 2;
        const centerY = position.height / 2;
        
        for (let i = 0; i < totalSeats; i++) {
          const angle = (i / totalSeats) * 2 * Math.PI - Math.PI / 2;
          const seatX = centerX + Math.cos(angle) * seatDistance;
          const seatY = centerY + Math.sin(angle) * seatDistance;
          
          let seatStatus = 'available';
          if (i < seatConfig.blocked) seatStatus = 'blocked';
          else if (i < seatConfig.blocked + seatConfig.lost) seatStatus = 'lost';
          
          seats.push({ x: seatX, y: seatY, status: seatStatus, index: i });
        }
      } else if (table.type === 'booth') {
        // Booth seating - seats on interior sides only
        const interiorSeats = Math.floor(totalSeats / 2);
        const topSeats = Math.ceil(totalSeats / 2);
        
        // Bottom side seats (interior)
        for (let i = 0; i < interiorSeats; i++) {
          const seatX = (position.width / (interiorSeats + 1)) * (i + 1);
          const seatY = position.height + seatRadius + 8;
          
          let seatStatus = 'available';
          if (i < seatConfig.blocked) seatStatus = 'blocked';
          else if (i < seatConfig.blocked + seatConfig.lost) seatStatus = 'lost';
          
          seats.push({ x: seatX, y: seatY, status: seatStatus, index: i });
        }
        
        // Top side seats (interior)
        for (let i = 0; i < topSeats; i++) {
          const seatX = (position.width / (topSeats + 1)) * (i + 1);
          const seatY = -seatRadius - 8;
          
          let seatStatus = 'available';
          const seatIndex = interiorSeats + i;
          if (seatIndex < seatConfig.blocked) seatStatus = 'blocked';
          else if (seatIndex < seatConfig.blocked + seatConfig.lost) seatStatus = 'lost';
          
          seats.push({ x: seatX, y: seatY, status: seatStatus, index: seatIndex });
        }
      } else {
        // Rectangular table - seats on all sides
        const longSide = position.width > position.height ? position.width : position.height;
        const shortSide = position.width > position.height ? position.height : position.width;
        const isWide = position.width > position.height;
        
        const longSideSeats = Math.ceil(totalSeats * 0.6);
        const shortSideSeats = Math.floor(totalSeats * 0.4);
        
        if (isWide) {
          // Long sides (top and bottom)
          const seatsPerLongSide = Math.ceil(longSideSeats / 2);
          
          // Top side
          for (let i = 0; i < seatsPerLongSide && seats.length < totalSeats; i++) {
            const seatX = (position.width / (seatsPerLongSide + 1)) * (i + 1);
            const seatY = -seatRadius - 8;
            
            let seatStatus = 'available';
            if (seats.length < seatConfig.blocked) seatStatus = 'blocked';
            else if (seats.length < seatConfig.blocked + seatConfig.lost) seatStatus = 'lost';
            
            seats.push({ x: seatX, y: seatY, status: seatStatus, index: seats.length });
          }
          
          // Bottom side
          for (let i = 0; i < seatsPerLongSide && seats.length < totalSeats; i++) {
            const seatX = (position.width / (seatsPerLongSide + 1)) * (i + 1);
            const seatY = position.height + seatRadius + 8;
            
            let seatStatus = 'available';
            if (seats.length < seatConfig.blocked) seatStatus = 'blocked';
            else if (seats.length < seatConfig.blocked + seatConfig.lost) seatStatus = 'lost';
            
            seats.push({ x: seatX, y: seatY, status: seatStatus, index: seats.length });
          }
          
          // Short sides (left and right)
          const seatsPerShortSide = Math.ceil(shortSideSeats / 2);
          
          // Left side
          for (let i = 0; i < seatsPerShortSide && seats.length < totalSeats; i++) {
            const seatX = -seatRadius - 8;
            const seatY = (position.height / (seatsPerShortSide + 1)) * (i + 1);
            
            let seatStatus = 'available';
            if (seats.length < seatConfig.blocked) seatStatus = 'blocked';
            else if (seats.length < seatConfig.blocked + seatConfig.lost) seatStatus = 'lost';
            
            seats.push({ x: seatX, y: seatY, status: seatStatus, index: seats.length });
          }
          
          // Right side
          for (let i = 0; i < seatsPerShortSide && seats.length < totalSeats; i++) {
            const seatX = position.width + seatRadius + 8;
            const seatY = (position.height / (seatsPerShortSide + 1)) * (i + 1);
            
            let seatStatus = 'available';
            if (seats.length < seatConfig.blocked) seatStatus = 'blocked';
            else if (seats.length < seatConfig.blocked + seatConfig.lost) seatStatus = 'lost';
            
            seats.push({ x: seatX, y: seatY, status: seatStatus, index: seats.length });
          }
        } else {
          // Tall table - distribute similarly but swap dimensions
          const seatsPerLongSide = Math.ceil(longSideSeats / 2);
          
          // Left side
          for (let i = 0; i < seatsPerLongSide && seats.length < totalSeats; i++) {
            const seatX = -seatRadius - 8;
            const seatY = (position.height / (seatsPerLongSide + 1)) * (i + 1);
            
            let seatStatus = 'available';
            if (seats.length < seatConfig.blocked) seatStatus = 'blocked';
            else if (seats.length < seatConfig.blocked + seatConfig.lost) seatStatus = 'lost';
            
            seats.push({ x: seatX, y: seatY, status: seatStatus, index: seats.length });
          }
          
          // Right side
          for (let i = 0; i < seatsPerLongSide && seats.length < totalSeats; i++) {
            const seatX = position.width + seatRadius + 8;
            const seatY = (position.height / (seatsPerLongSide + 1)) * (i + 1);
            
            let seatStatus = 'available';
            if (seats.length < seatConfig.blocked) seatStatus = 'blocked';
            else if (seats.length < seatConfig.blocked + seatConfig.lost) seatStatus = 'lost';
            
            seats.push({ x: seatX, y: seatY, status: seatStatus, index: seats.length });
          }
          
          // Top and bottom sides
          const seatsPerShortSide = Math.ceil(shortSideSeats / 2);
          
          // Top side
          for (let i = 0; i < seatsPerShortSide && seats.length < totalSeats; i++) {
            const seatX = (position.width / (seatsPerShortSide + 1)) * (i + 1);
            const seatY = -seatRadius - 8;
            
            let seatStatus = 'available';
            if (seats.length < seatConfig.blocked) seatStatus = 'blocked';
            else if (seats.length < seatConfig.blocked + seatConfig.lost) seatStatus = 'lost';
            
            seats.push({ x: seatX, y: seatY, status: seatStatus, index: seats.length });
          }
          
          // Bottom side
          for (let i = 0; i < seatsPerShortSide && seats.length < totalSeats; i++) {
            const seatX = (position.width / (seatsPerShortSide + 1)) * (i + 1);
            const seatY = position.height + seatRadius + 8;
            
            let seatStatus = 'available';
            if (seats.length < seatConfig.blocked) seatStatus = 'blocked';
            else if (seats.length < seatConfig.blocked + seatConfig.lost) seatStatus = 'lost';
            
            seats.push({ x: seatX, y: seatY, status: seatStatus, index: seats.length });
          }
        }
      }
      
      return seats;
    };
    
    const seatPositions = generateSeatPositions();
    
    const getSeatColor = (status: string) => {
      switch (status) {
        case 'blocked': return '#f97316'; // Orange
        case 'lost': return '#6b7280'; // Gray
        default: return '#3b82f6'; // Blue
      }
    };
    
    const transform = `translate(${position.x + position.width/2}, ${position.y + position.height/2}) rotate(${position.rotation}) translate(${-position.width/2}, ${-position.height/2})`;
    
    if (table.shape === 'round') {
      const radius = Math.min(position.width, position.height) / 2;
      const centerX = position.width / 2;
      const centerY = position.height / 2;
      
      return (
        <g key={position.id} transform={transform}>
          {/* Table surface */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill={isSelected ? '#3b82f6' : '#f8fafc'}
            stroke={isSelected ? '#1d4ed8' : '#e2e8f0'}
            strokeWidth={2}
            className="cursor-pointer"
            onClick={() => handleTableClick(position.id)}
          />
          
          {/* Table label */}
          <text
            x={centerX}
            y={centerY}
            textAnchor="middle"
            dominantBaseline="central"
            className="text-sm font-medium fill-slate-900 pointer-events-none"
          >
            {table.table_number}
          </text>
          
          {/* Individual seats */}
          {seatPositions.map((seat, index) => (
            <circle
              key={index}
              cx={seat.x}
              cy={seat.y}
              r={6}
              fill={getSeatColor(seat.status)}
              stroke="#ffffff"
              strokeWidth={1}
              className="cursor-pointer hover:opacity-80"
              onClick={(e) => {
                e.stopPropagation();
                // Handle seat click - could toggle status
              }}
            />
          ))}
        </g>
      );
    }
    
    // Default rectangular/booth shape
    return (
      <g key={position.id} transform={transform}>
        {/* Table surface */}
        <rect
          x={0}
          y={0}
          width={position.width}
          height={position.height}
          rx={8}
          fill={isSelected ? '#3b82f6' : '#f8fafc'}
          stroke={isSelected ? '#1d4ed8' : '#e2e8f0'}
          strokeWidth={2}
          className="cursor-pointer"
          onClick={() => handleTableClick(position.id)}
        />
        
        {/* Table label */}
        <text
          x={position.width / 2}
          y={position.height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-sm font-medium fill-slate-900 pointer-events-none"
        >
          {table.table_number}
        </text>
        
        {/* Individual seats */}
        {seatPositions.map((seat, index) => (
          <circle
            key={index}
            cx={seat.x}
            cy={seat.y}
            r={6}
            fill={getSeatColor(seat.status)}
            stroke="#ffffff"
            strokeWidth={1}
            className="cursor-pointer hover:opacity-80"
            onClick={(e) => {
              e.stopPropagation();
              // Handle seat click - could toggle status
            }}
          />
        ))}
      </g>
    );
  };

  const selectedTable = selectedTableId ? getTableById(selectedTableId) : null;
  const selectedSeatConfig = selectedTableId ? seatConfigs[selectedTableId] : null;

  return (
    <div className="h-full flex gap-4">
      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Table Layout - {groupName}
            </h3>
            <p className="text-sm text-muted-foreground">
              Click tables to configure seats and arrangement
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGrid(!showGrid)}
              className={showGrid ? 'bg-muted' : ''}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="flex-1 bg-slate-950">
          <CardContent className="p-4 h-full">
            <svg
              className="w-full h-full overflow-hidden rounded-lg"
              style={{
                backgroundImage: showGrid 
                  ? 'radial-gradient(circle, rgba(148, 163, 184, 0.1) 1px, transparent 1px)' 
                  : 'none',
                backgroundSize: showGrid ? '20px 20px' : 'auto',
                transform: `scale(${zoom})`,
                transformOrigin: '0 0'
              }}
              viewBox="0 0 800 600"
            >
              {tablePositions.map(position => {
                const table = getTableById(position.id);
                return table ? renderTableShape(position, table) : null;
              })}
            </svg>
          </CardContent>
        </Card>
      </div>

      {/* Side Panel */}
      <div className="w-80 space-y-4">
        {/* Capacity Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Capacity Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Total Seats</div>
                <div className="font-mono font-medium">{capacity.total}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Effective</div>
                <div className="font-mono font-medium text-primary">{capacity.effective}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Blocked</div>
                <div className="font-mono font-medium text-orange-500">{capacity.blocked}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Lost</div>
                <div className="font-mono font-medium text-destructive">{capacity.lost}</div>
              </div>
            </div>
            
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Efficiency</span>
                <Badge 
                  variant={efficiency >= 90 ? "default" : efficiency >= 75 ? "secondary" : "destructive"}
                  className="text-xs"
                >
                  {efficiency}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Details */}
        {selectedTable && selectedSeatConfig && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Table {selectedTable.table_number}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rotateTable(selectedTable.id)}
                >
                  <RotateCw className="h-3 w-3" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <div className="text-muted-foreground">Shape: {selectedTable.shape || 'Rectangle'}</div>
                <div className="text-muted-foreground">Base Seats: {selectedTable.seats}</div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-muted-foreground">Available</label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => updateSeatConfig(selectedTable.id, 'available', selectedSeatConfig.available - 1)}
                    >
                      -
                    </Button>
                    <span className="text-sm font-mono w-8 text-center">{selectedSeatConfig.available}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => updateSeatConfig(selectedTable.id, 'available', selectedSeatConfig.available + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm text-muted-foreground">Blocked</label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => updateSeatConfig(selectedTable.id, 'blocked', selectedSeatConfig.blocked - 1)}
                    >
                      -
                    </Button>
                    <span className="text-sm font-mono w-8 text-center">{selectedSeatConfig.blocked}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => updateSeatConfig(selectedTable.id, 'blocked', selectedSeatConfig.blocked + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm text-muted-foreground">Lost (connections)</label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => updateSeatConfig(selectedTable.id, 'lost', selectedSeatConfig.lost - 1)}
                    >
                      -
                    </Button>
                    <span className="text-sm font-mono w-8 text-center">{selectedSeatConfig.lost}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => updateSeatConfig(selectedTable.id, 'lost', selectedSeatConfig.lost + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tables in Group</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tables.map(table => {
                const config = seatConfigs[table.id];
                const isSelected = selectedTableId === table.id;
                
                return (
                  <div
                    key={table.id}
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleTableClick(table.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Table {table.table_number}</span>
                      <Badge variant="outline" className="text-xs">
                        {config?.available || table.seats}s
                      </Badge>
                    </div>
                    <ChevronDown 
                      className={`h-3 w-3 transition-transform ${
                        isSelected ? 'rotate-180' : ''
                      }`} 
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};