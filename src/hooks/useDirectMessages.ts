
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/components/staff-notes/types';

export const useDirectMessages = (currentUserId: string | null) => {
  const [directMessageUsers, setDirectMessageUsers] = useState<User[]>([]);
  const { toast } = useToast();

  const fetchDirectMessageUsers = async () => {
    if (!currentUserId) return;

    try {
      // Get all unique users that have direct message conversations with the current user
      // We need to get users where they are either the sender or recipient of direct messages
      const { data, error } = await supabase
        .from('messages')
        .select(`
          user_id,
          recipient_id,
          users!messages_user_id_fkey(id, full_name, role),
          recipient_users:users!messages_recipient_id_fkey(id, full_name, role)
        `)
        .is('channel_id', null)
        .or(`user_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`);

      if (error) {
        console.error('Error fetching direct message users:', error);
        toast({
          title: "Error",
          description: "Failed to fetch direct message conversations",
          variant: "destructive",
        });
      } else {
        // Extract unique users from both sender and recipient perspectives
        const uniqueUsers = new Map<string, User>();
        
        data.forEach((message: any) => {
          // If current user sent the message, add the recipient
          if (message.user_id === currentUserId && message.recipient_users) {
            const user = {
              id: message.recipient_users.id,
              full_name: message.recipient_users.full_name,
              role: message.recipient_users.role,
            };
            uniqueUsers.set(user.id, user);
          }
          
          // If current user received the message, add the sender
          if (message.recipient_id === currentUserId && message.users) {
            const user = {
              id: message.users.id,
              full_name: message.users.full_name,
              role: message.users.role,
            };
            uniqueUsers.set(user.id, user);
          }
        });

        setDirectMessageUsers(Array.from(uniqueUsers.values()));
      }
    } catch (error) {
      console.error('Error fetching direct message users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch direct message conversations",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (currentUserId) {
      fetchDirectMessageUsers();
    }
  }, [currentUserId]);

  return { directMessageUsers, fetchDirectMessageUsers };
};
