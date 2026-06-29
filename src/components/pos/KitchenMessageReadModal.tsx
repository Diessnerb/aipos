import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface KitchenMessageReadModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  requestId: string;
}

export const KitchenMessageReadModal = ({
  isOpen,
  onClose,
  message,
  requestId,
}: KitchenMessageReadModalProps) => {
  const queryClient = useQueryClient();

  const handleMarkAsRead = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('kitchen_service_requests')
        .update({
          status: 'dismissed',
          dismissed_at: new Date().toISOString(),
          dismissed_by: user?.user?.id,
        })
        .eq('id', requestId);
        
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['kitchen-service-requests'] });
      toast.success('Message marked as read');
      onClose();
    } catch (error: any) {
      console.error('[KitchenMessage] Mark as read failed:', error);
      toast.error('Failed to mark message as read');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kitchen Message</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-muted p-4 rounded-md">
            <p className="text-sm whitespace-pre-wrap">{message}</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleMarkAsRead}>
            Mark as Read
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
