import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredientName: string;
  currentStock: number;
  unit: string;
  type: 'add' | 'remove' | 'adjust';
  onSubmit: (quantity: number, reason: string, notes: string) => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  ingredientName,
  currentStock,
  unit,
  type,
  onSubmit,
}) => {
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Set default reason based on type when modal opens
  useEffect(() => {
    if (isOpen) {
      if (type === 'add') {
        setReason('Delivery');
      } else if (type === 'remove') {
        setReason('Used in Service');
      } else if (type === 'adjust') {
        setReason('Manual Count');
      }
    }
  }, [isOpen, type]);

  const handleSubmit = () => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;
    
    onSubmit(qty, reason, notes);
    setQuantity('');
    setReason('');
    setNotes('');
    onClose();
  };

  const getTitle = () => {
    switch (type) {
      case 'add':
        return `Add Stock - ${ingredientName}`;
      case 'remove':
        return `Remove Stock - ${ingredientName}`;
      case 'adjust':
        return `Manual Stock Count - ${ingredientName}`;
      default:
        return 'Stock Adjustment';
    }
  };

  const getReasonOptions = () => {
    if (type === 'add') {
      return ['Delivery', 'Manual Count', 'Return', 'Other'];
    } else if (type === 'remove') {
      return ['Used in Service', 'Waste', 'Expired', 'Other'];
    }
    return ['Manual Count', 'Correction', 'Other'];
  };

  const calculateNewStock = () => {
    const qty = parseFloat(quantity);
    if (isNaN(qty)) return currentStock;
    
    if (type === 'add') {
      return currentStock + qty;
    } else if (type === 'remove') {
      return Math.max(0, currentStock - qty);
    } else {
      return qty;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            Current stock: {currentStock} {unit}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">
              {type === 'adjust' ? 'Actual Count' : 'Quantity'}
            </Label>
            <div className="flex gap-2">
              <Input
                id="quantity"
                type="number"
                min="0"
                step="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
              />
              <span className="flex items-center px-3 bg-muted rounded-md text-sm">
                {unit}
              </span>
            </div>
            {quantity && (
              <p className="text-sm text-muted-foreground">
                New stock will be: <strong>{calculateNewStock()} {unit}</strong>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {getReasonOptions().map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!quantity || !reason}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
