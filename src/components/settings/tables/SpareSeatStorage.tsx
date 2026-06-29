import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, RotateCcw, Trash2, Archive } from 'lucide-react';
import { SeatPosition } from '@/types/table';
import { toast } from 'sonner';

interface SpareSeatStorageProps {
  spareSeats: SeatPosition[];
  onRestoreSeat: (seatId: string) => void;
  onDeleteSeat: (seatId: string) => void;
  onClearAllSpares: () => void;
}

export const SpareSeatStorage = ({
  spareSeats,
  onRestoreSeat,
  onDeleteSeat,
  onClearAllSpares
}: SpareSeatStorageProps) => {
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);

  const getReasonLabel = (reason?: string) => {
    switch (reason) {
      case 'lost_connection':
        return { label: 'Connection Lost', color: 'destructive' as const };
      case 'manually_blocked':
        return { label: 'Manually Blocked', color: 'secondary' as const };
      case 'temporary_removal':
        return { label: 'Temporary', color: 'outline' as const };
      default:
        return { label: 'Unknown', color: 'secondary' as const };
    }
  };

  const handleRestoreSeat = (seatId: string) => {
    onRestoreSeat(seatId);
    toast.success('Seat restored to table');
  };

  const handleDeleteSeat = (seatId: string) => {
    onDeleteSeat(seatId);
    toast.success('Spare seat permanently deleted');
  };

  return (
    <Card className="w-80 flex-shrink-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5" />
          Spare Seat Storage
          {spareSeats.length > 0 && (
            <Badge variant="secondary">{spareSeats.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {spareSeats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Archive className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No spare seats stored</p>
            <p className="text-xs">Blocked or lost seats will appear here</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {spareSeats.map((seat) => {
                  const reason = getReasonLabel(seat.spare_reason);
                  const isSelected = selectedSeat === seat.id;
                  
                  return (
                    <div
                      key={seat.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedSeat(isSelected ? null : seat.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm">
                            Seat #{seat.seat_number}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            From Table {seat.original_table_id || 'Unknown'}
                          </p>
                        </div>
                        <Badge variant={reason.color} className="text-xs">
                          {reason.label}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {seat.seat_type === 'accessible' ? '♿' : '💺'} 
                          {seat.seat_type}
                        </span>
                        {seat.removal_timestamp && (
                          <span>
                            • {new Date(seat.removal_timestamp).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      
                      {isSelected && (
                        <div className="flex gap-2 mt-3 pt-2 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreSeat(seat.id);
                            }}
                            className="flex-1"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSeat(seat.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            
            {spareSeats.length > 1 && (
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearAllSpares}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All Spares
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};