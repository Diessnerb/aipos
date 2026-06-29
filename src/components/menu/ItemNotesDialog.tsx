import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface ItemNotesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export const ItemNotesDialog: React.FC<ItemNotesDialogProps> = ({
  isOpen,
  onClose,
  notes,
  onNotesChange,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add special instructions or notes..."
          className="min-h-[120px] resize-none"
          autoFocus
        />
      </DialogContent>
    </Dialog>
  );
};
