import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface MenuItemUsage {
  id: string;
  name: string;
}

interface LinkedItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItemUsage[];
}

export const LinkedItemsModal: React.FC<LinkedItemsModalProps> = ({
  isOpen,
  onClose,
  menuItems,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        
        <ul className="space-y-2">
          {menuItems.map(item => (
            <li
              key={item.id}
              className="text-sm text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
            >
              • {item.name}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
};
