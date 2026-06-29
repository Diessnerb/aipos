
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Message } from '@/components/staff-notes/types';

export const useMessages = (channelId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchMessages = useCallback(async (selectedChannelId: string, options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          users!messages_user_id_fkey(full_name, role)
        `)
        .eq('channel_id', selectedChannelId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        if (!options?.silent) {
          toast({
            title: "Error",
            description: "Failed to fetch messages",
            variant: "destructive",
          });
        }
      } else {
        setMessages(data || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      if (!options?.silent) {
        toast({
          title: "Error",
          description: "Failed to fetch messages",
          variant: "destructive",
        });
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [toast]);

  const sendMessage = async (content: string, channelId: string, userId: string) => {
    try {
      // Optimistic update
      const tempId = `temp_${Date.now()}`;
      const optimisticMessage: Message = {
        id: tempId,
        content,
        channel_id: channelId,
        user_id: userId,
        created_at: new Date().toISOString(),
        users: { full_name: 'You', role: 'current' } // Placeholder for current user
      };
      
      setMessages(prevMessages => [optimisticMessage, ...prevMessages]);

      console.log('Sending message with user ID:', userId);
      const { error } = await supabase
        .from('messages')
        .insert([
          {
            content,
            channel_id: channelId,
            user_id: userId,
          },
        ]);

      if (error) {
        // Rollback optimistic update
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        console.error('Error sending message:', error);
        toast({
          title: "Error",
          description: "Failed to send message",
          variant: "destructive",
        });
        return false;
      } else {
        // The real message will come through real-time subscription
        // Remove the optimistic update since real message will replace it
        setTimeout(() => {
          setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        }, 2000); // Give time for real-time to arrive
        return true;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    if (channelId) {
      fetchMessages(channelId);
    } else {
      setMessages([]);
    }
  }, [channelId]);

  // Real-time subscription for messages updates
  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`messages-updates-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          console.log('Real-time messages update:', payload);
          
          // Handle different events with incremental updates
          if (payload.eventType === 'INSERT' && payload.new) {
            const newMessage = payload.new as Message;
            setMessages(prevMessages => {
              const existingIndex = prevMessages.findIndex(msg => msg.id === newMessage.id);
              if (existingIndex === -1) {
                return [...prevMessages, newMessage].sort((a, b) => 
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
              }
              return prevMessages;
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedMessage = payload.new as Message;
            setMessages(prevMessages => 
              prevMessages.map(msg => 
                msg.id === updatedMessage.id ? updatedMessage : msg
              )
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setMessages(prevMessages => 
              prevMessages.filter(msg => msg.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  return { messages, loading, fetchMessages, sendMessage };
};
