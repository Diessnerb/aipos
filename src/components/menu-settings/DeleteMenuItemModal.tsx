import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  tags: string[] | null;
  allergens: string[] | null;
}

interface DeleteMenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem | null;
}

const DeleteMenuItemModal = ({ isOpen, onClose, menuItem }: DeleteMenuItemModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const deleteMenuItemMutation = useMutation({
    mutationFn: async () => {
      if (!menuItem) return;
      
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', menuItem.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-builder', companyId] });
      toast({
        title: 'Success',
        description: 'Menu item deleted successfully',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to delete menu item',
        variant: 'destructive',
      });
      console.error('Error deleting menu item:', error);
    },
  });

  const handleDelete = async () => {
    if (!menuItem) return;
    
    setIsLoading(true);
    try {
      await deleteMenuItemMutation.mutateAsync();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <DialogTitle>Delete Menu Item</DialogTitle>
          </div>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the menu item.
          </DialogDescription>
        </DialogHeader>
        
        {menuItem && (
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-semibold">{menuItem.name}</h4>
            <p className="text-sm text-muted-foreground">£{menuItem.price}</p>
            {menuItem.description && (
              <p className="text-sm text-muted-foreground mt-1">{menuItem.description}</p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Deleting...' : 'Delete Item'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteMenuItemModal;