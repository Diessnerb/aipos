
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Message } from '@/components/staff-notes/types';

export const useDirectMessageMessages = (currentUserId: string | null, selectedUserId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchDirectMessages = async (userId1: string, userId2: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          users!messages_user_id_fkey(full_name, role)
        `)
        .is('channel_id', null)
        .or(`and(user_id.eq.${userId1},recipient_id.eq.${userId2}),and(user_id.eq.${userId2},recipient_id.eq.${userId1})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching direct messages:', error);
        toast({
          title: "Error",
          description: "Failed to fetch direct messages",
          variant: "destructive",
        });
      } else {
        setMessages(data || []);
      }
    } catch (error) {
      console.error('Error fetching direct messages:', error);
      toast({
        title: "Error",
        description: "Failed to fetch direct messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendDirectMessage = async (content: string, senderId: string, recipientId: string) => {
    try {
      console.log('Sending direct message:', { content, senderId, recipientId });
      const { error } = await supabase
        .from('messages')
        .insert([
          {
            content,
            user_id: senderId,
            recipient_id: recipientId,
            channel_id: null,
          },
        ]);

      if (error) {
        console.error('Error sending direct message:', error);
        toast({
          title: "Error",
          description: "Failed to send direct message",
          variant: "destructive",
        });
        return false;
      } else {
        // Refresh messages after sending
        if (currentUserId && selectedUserId) {
          fetchDirectMessages(currentUserId, selectedUserId);
        }
        return true;
      }
    } catch (error) {
      console.error('Error sending direct message:', error);
      toast({
        title: "Error",
        description: "Failed to send direct message",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    if (currentUserId && selectedUserId) {
      fetchDirectMessages(currentUserId, selectedUserId);
    } else {
      setMessages([]);
    }
  }, [currentUserId, selectedUserId]);

  return { messages, loading, fetchDirectMessages, sendDirectMessage };
};
