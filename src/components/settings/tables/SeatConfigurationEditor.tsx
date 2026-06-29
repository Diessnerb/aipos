import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Table, SeatPosition } from '@/types/table';

interface SeatConfigurationEditorProps {
  table: Table;
  onSave: (tableId: string, seatPositions: SeatPosition[]) => void;
  onClose: () => void;
  existingSeatPositions?: SeatPosition[];
}

export const SeatConfigurationEditor: React.FC<SeatConfigurationEditorProps> = ({
  table,
  onSave,
  onClose,
  existingSeatPositions = []
}) => {
  const [seatPositions, setSeatPositions] = useState<SeatPosition[]>(existingSeatPositions);
  const [sideSeats, setSideSeats] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  });
  const [selectedSeat, setSelectedSeat] = useState<SeatPosition | null>(null);
  const [mode, setMode] = useState<'sides' | 'visual'>('sides');

  // Initialize side counts from existing positions - Fix infinite loop
  useEffect(() => {
    if (existingSeatPositions.length > 0) {
      // Calculate seats per side based on positions
      const tableWidth = 120;
      const tableHeight = 80;
      const centerX = tableWidth / 2;
      const centerY = tableHeight / 2;
      
      const sides = { top: 0, bottom: 0, left: 0, right: 0 };
      
      existingSeatPositions.forEach(seat => {
        if (seat.y_position < centerY - 20) sides.top++;
        else if (seat.y_position > centerY + 20) sides.bottom++;
        else if (seat.x_position < centerX) sides.left++;
        else sides.right++;
      });
      
      setSideSeats(sides);
      setSeatPositions(existingSeatPositions);
    } else if (seatPositions.length === 0) {
      // Only auto-distribute if we don't have seat positions yet
      autoDistributeSeats();
    }
  }, [table.id, table.seats]); // Only depend on stable table properties

  const autoDistributeSeats = () => {
    const totalSeats = table.seats;
    let distribution = { top: 0, bottom: 0, left: 0, right: 0 };

    if (table.shape === 'round') {
      // Distribute evenly around circle
      const perSide = Math.floor(totalSeats / 4);
      const remainder = totalSeats % 4;
      distribution = {
        top: perSide + (remainder > 0 ? 1 : 0),
        right: perSide + (remainder > 1 ? 1 : 0),
        bottom: perSide + (remainder > 2 ? 1 : 0),
        left: perSide
      };
    } else if (table.type === 'booth') {
      // Booth typically has seats on interior sides only
      distribution = {
        top: Math.floor(totalSeats / 2),
        bottom: Math.ceil(totalSeats / 2),
        left: 0,
        right: 0
      };
    } else {
      // Rectangular - prioritize longer sides
      const longSides = Math.floor(totalSeats * 0.7);
      const shortSides = totalSeats - longSides;
      distribution = {
        top: Math.floor(longSides / 2),
        bottom: Math.ceil(longSides / 2),
        left: Math.floor(shortSides / 2),
        right: Math.ceil(shortSides / 2)
      };
    }

    setSideSeats(distribution);
    generateSeatPositions(distribution);
  };

  const generateSeatPositions = (sides: typeof sideSeats) => {
    const tableWidth = 120;
    const tableHeight = 80;
    const seatSize = 8;
    const positions: SeatPosition[] = [];
    let seatNumber = 1;

    // Generate positions for each side
    const { top, bottom, left, right } = sides;

    // Top side
    for (let i = 0; i < top; i++) {
      positions.push({
        id: `seat-${seatNumber}`,
        table_id: table.id,
        company_id: table.company_id,
        seat_number: seatNumber++,
        x_position: (tableWidth / (top + 1)) * (i + 1),
        y_position: -seatSize,
        seat_type: 'standard',
        seat_status: 'available',
        is_accessible: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Bottom side
    for (let i = 0; i < bottom; i++) {
      positions.push({
        id: `seat-${seatNumber}`,
        table_id: table.id,
        company_id: table.company_id,
        seat_number: seatNumber++,
        x_position: (tableWidth / (bottom + 1)) * (i + 1),
        y_position: tableHeight + seatSize,
        seat_type: 'standard',
        seat_status: 'available',
        is_accessible: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Left side
    for (let i = 0; i < left; i++) {
      positions.push({
        id: `seat-${seatNumber}`,
        table_id: table.id,
        company_id: table.company_id,
        seat_number: seatNumber++,
        x_position: -seatSize,
        y_position: (tableHeight / (left + 1)) * (i + 1),
        seat_type: 'standard',
        seat_status: 'available',
        is_accessible: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Right side
    for (let i = 0; i < right; i++) {
      positions.push({
        id: `seat-${seatNumber}`,
        table_id: table.id,
        company_id: table.company_id,
        seat_number: seatNumber++,
        x_position: tableWidth + seatSize,
        y_position: (tableHeight / (right + 1)) * (i + 1),
        seat_type: 'standard',
        seat_status: 'available',
        is_accessible: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    setSeatPositions(positions);
  };

  const handleSideSeatsChange = (side: keyof typeof sideSeats, value: number) => {
    const newSideSeats = { ...sideSeats, [side]: Math.max(0, value) };
    setSideSeats(newSideSeats);
    generateSeatPositions(newSideSeats);
  };

  const handleSeatClick = (seat: SeatPosition) => {
    setSelectedSeat(seat);
  };

  const updateSeatProperty = (property: keyof SeatPosition, value: any) => {
    if (!selectedSeat) return;
    
    const updatedPositions = seatPositions.map(seat => 
      seat.id === selectedSeat.id 
        ? { ...seat, [property]: value }
        : seat
    );
    
    setSeatPositions(updatedPositions);
    setSelectedSeat({ ...selectedSeat, [property]: value });
  };

  const handleSave = () => {
    if (seatPositions.length !== table.seats) {
      toast.error(`Seat count mismatch: ${seatPositions.length} seats configured, but table has ${table.seats} seats`);
      return;
    }
    
    onSave(table.id, seatPositions);
    toast.success(`Seat layout saved for ${table.table_name}`);
    onClose();
  };

  const getSeatColor = (status: string) => {
    switch (status) {
      case 'available': return 'hsl(var(--primary))';
      case 'blocked': return 'hsl(var(--destructive))';
      case 'lost': return 'hsl(var(--muted))';
      default: return 'hsl(var(--primary))';
    }
  };

  const totalConfiguredSeats = Object.values(sideSeats).reduce((sum, count) => sum + count, 0);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Configure Seats for {table.table_name}
          <div className="flex gap-2">
            <Badge variant={totalConfiguredSeats === table.seats ? "default" : "destructive"}>
              {totalConfiguredSeats}/{table.seats} seats
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setMode(mode === 'sides' ? 'visual' : 'sides')}>
              {mode === 'sides' ? 'Visual Mode' : 'Sides Mode'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Visual Preview */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Seat Layout Preview</Label>
            <div className="relative border rounded-lg p-8 bg-muted/20 min-h-[300px] flex items-center justify-center">
              <svg width="200" height="160" viewBox="0 0 200 160" className="border">
                {/* Table Shape */}
                <g transform="translate(40, 40)">
                  {table.shape === 'round' ? (
                    <circle
                      cx={60}
                      cy={40}
                      r={35}
                      fill="hsl(var(--muted))"
                      stroke="hsl(var(--border))"
                      strokeWidth={2}
                    />
                  ) : (
                    <rect
                      x={0}
                      y={0}
                      width={120}
                      height={80}
                      rx={table.shape === 'booth' ? 8 : 4}
                      fill="hsl(var(--muted))"
                      stroke="hsl(var(--border))"
                      strokeWidth={2}
                    />
                  )}
                  
                  {/* Seats */}
                  {seatPositions.map((seat) => (
                    <circle
                      key={seat.id}
                      cx={seat.x_position}
                      cy={seat.y_position}
                      r={6}
                      fill={getSeatColor(seat.seat_status)}
                      stroke={selectedSeat?.id === seat.id ? 'hsl(var(--ring))' : 'hsl(var(--border))'}
                      strokeWidth={selectedSeat?.id === seat.id ? 3 : 1}
                      className="cursor-pointer hover:opacity-80"
                      onClick={() => handleSeatClick(seat)}
                    />
                  ))}
                </g>
              </svg>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {mode === 'sides' ? (
              <>
                <Label className="text-sm font-medium">Seats per Side</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="top-seats" className="text-xs">Top</Label>
                    <Input
                      id="top-seats"
                      type="number"
                      min="0"
                      value={sideSeats.top}
                      onChange={(e) => handleSideSeatsChange('top', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bottom-seats" className="text-xs">Bottom</Label>
                    <Input
                      id="bottom-seats"
                      type="number"
                      min="0"
                      value={sideSeats.bottom}
                      onChange={(e) => handleSideSeatsChange('bottom', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="left-seats" className="text-xs">Left</Label>
                    <Input
                      id="left-seats"
                      type="number"
                      min="0"
                      value={sideSeats.left}
                      onChange={(e) => handleSideSeatsChange('left', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="right-seats" className="text-xs">Right</Label>
                    <Input
                      id="right-seats"
                      type="number"
                      min="0"
                      value={sideSeats.right}
                      onChange={(e) => handleSideSeatsChange('right', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
                
                <Button variant="outline" onClick={autoDistributeSeats} className="w-full">
                  Auto-distribute Seats
                </Button>
              </>
            ) : (
              <div>
                <Label className="text-sm font-medium mb-2 block">Click seats to select and configure</Label>
              </div>
            )}

            {/* Selected Seat Properties */}
            {selectedSeat && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                <Label className="text-sm font-medium">Seat #{selectedSeat.seat_number}</Label>
                
                <div>
                  <Label htmlFor="seat-type" className="text-xs">Type</Label>
                  <Select
                    value={selectedSeat.seat_type}
                    onValueChange={(value) => updateSeatProperty('seat_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="accessible">Accessible</SelectItem>
                      <SelectItem value="high_chair">High Chair</SelectItem>
                      <SelectItem value="booth">Booth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="seat-status" className="text-xs">Status</Label>
                  <Select
                    value={selectedSeat.seat_status}
                    onValueChange={(value) => updateSeatProperty('seat_status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={totalConfiguredSeats !== table.seats}>
            Save Seat Layout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};