import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle, Clock, Users } from 'lucide-react';
import { StatusChangeImpact } from '@/services/tableStatusChangeHandler';

interface TableServiceImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  impact: StatusChangeImpact | null;
  tableNumber: number;
  onConfirm: () => Promise<void>;
}

export const TableServiceImpactModal: React.FC<TableServiceImpactModalProps> = ({
  isOpen,
  onClose,
  impact,
  tableNumber,
  onConfirm,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Failed to execute reassignments:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!impact) return null;

  const hasReassignable = impact.reassignableReservations.length > 0;
  const hasImpossible = impact.impossibleReservations.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Table {tableNumber} Going Out of Service
          </DialogTitle>
          <DialogDescription>
            {impact.affectedReservations.length} reservation(s) are currently assigned to this table.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reassignable Reservations */}
          {hasReassignable && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <h3 className="font-semibold">Can Auto-Reassign ({impact.reassignableReservations.length})</h3>
              </div>
              <ScrollArea className="h-40 rounded-md border p-4">
                <div className="space-y-2">
                  {impact.reassignableReservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{reservation.customer_name}</span>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {reservation.date} at {reservation.time}
                          <Users className="h-3 w-3 ml-2" />
                          {reservation.party_size} guests
                        </div>
                      </div>
                      <Badge variant="secondary">Can reassign</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Impossible Reservations */}
          {hasImpossible && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <h3 className="font-semibold">Need Manual Attention ({impact.impossibleReservations.length})</h3>
              </div>
              <ScrollArea className="h-40 rounded-md border p-4">
                <div className="space-y-2">
                  {impact.impossibleReservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="flex items-center justify-between p-2 rounded-md bg-destructive/10"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{reservation.customer_name}</span>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {reservation.date} at {reservation.time}
                          <Users className="h-3 w-3 ml-2" />
                          {reservation.party_size} guests
                        </div>
                      </div>
                      <Badge variant="destructive">Manual needed</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {!hasReassignable && !hasImpossible && (
            <div className="text-center py-6 text-muted-foreground">
              No affected reservations found.
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || !hasReassignable}
          >
            {isProcessing ? 'Processing...' : 'Confirm & Reassign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
