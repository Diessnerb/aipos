import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface KitchenMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KitchenMessageModal = ({ isOpen, onClose }: KitchenMessageModalProps) => {
  const { companyId } = useAuth();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const maxLength = 200;
  const remainingChars = maxLength - message.length;

  const handleSend = async () => {
    if (!companyId || !message.trim()) return;
    
    setIsSending(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('kitchen_service_requests')
        .insert({
          company_id: companyId,
          type: 'message',
          message: message.trim(),
          created_by: user?.user?.id,
        });
        
      if (error) throw error;
      
      toast.success('Message sent to floor staff');
      setMessage('');
      onClose();
    } catch (error: any) {
      console.error('[KitchenMessage] Send failed:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Message to Floor Staff</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Textarea
            placeholder="Type your message here... (e.g., 'Need more napkins' or 'Can someone grab ice from the bar?')"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, maxLength))}
            className="min-h-[120px] resize-none"
            maxLength={maxLength}
          />
          
          <div className="text-sm text-muted-foreground text-right">
            {remainingChars} characters remaining
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !message.trim()}
          >
            {isSending ? 'Sending...' : 'Send Message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
