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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { BasketItem } from '@/contexts/OrderBasketContext';
import { AlertTriangle, Package, ChefHat, RotateCcw, FileQuestion } from 'lucide-react';

interface WastageReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basketItem: BasketItem | null;
  onConfirm: (reason: string, notes: string) => void;
}

const WASTAGE_REASONS = [
  { value: 'expired', label: 'Expired', icon: AlertTriangle, color: 'text-red-500' },
  { value: 'damaged', label: 'Damaged', icon: Package, color: 'text-orange-500' },
  { value: 'overproduction', label: 'Overproduction', icon: ChefHat, color: 'text-blue-500' },
  { value: 'customer_return', label: 'Customer Return', icon: RotateCcw, color: 'text-purple-500' },
  { value: 'other', label: 'Other', icon: FileQuestion, color: 'text-gray-500' },
];

export const WastageReasonDialog: React.FC<WastageReasonDialogProps> = ({
  open,
  onOpenChange,
  basketItem,
  onConfirm,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('overproduction');
  const [notes, setNotes] = useState<string>('');

  const handleConfirm = () => {
    onConfirm(selectedReason, notes);
    // Reset state
    setSelectedReason('overproduction');
    setNotes('');
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset state
    setSelectedReason('overproduction');
    setNotes('');
  };

  if (!basketItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Log Wastage</DialogTitle>
          <DialogDescription>
            Why is "{basketItem.menuItem.name}" being wasted?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground">
            This will log wastage for the ingredients in this item (×{basketItem.quantity})
          </div>

          <div className="space-y-3">
            <Label>Wastage Reason</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {WASTAGE_REASONS.map((reason) => {
                const Icon = reason.icon;
                return (
                  <div
                    key={reason.value}
                    className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent transition-colors"
                  >
                    <RadioGroupItem value={reason.value} id={reason.value} />
                    <Label
                      htmlFor={reason.value}
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <Icon className={`h-4 w-4 ${reason.color}`} />
                      <span>{reason.label}</span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Confirm Wastage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
