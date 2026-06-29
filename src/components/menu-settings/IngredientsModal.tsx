import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MenuItemIngredientsManager } from '@/components/settings/MenuItemIngredientsManager';

interface IngredientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItemId: string;
  menuItemName: string;
}

export const IngredientsModal: React.FC<IngredientsModalProps> = ({
  isOpen,
  onClose,
  menuItemId,
  menuItemName,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ingredients - {menuItemName}</DialogTitle>
        </DialogHeader>
        
        <MenuItemIngredientsManager menuItemId={menuItemId} />
      </DialogContent>
    </Dialog>
  );
};
