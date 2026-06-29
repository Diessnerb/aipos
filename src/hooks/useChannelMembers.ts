
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/components/staff-notes/types';

export const useChannelMembers = (channelId: string | null) => {
  const [channelMembers, setChannelMembers] = useState<User[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const { toast } = useToast();

  const fetchChannelMembers = async (selectedChannelId: string) => {
    try {
      const { data, error } = await supabase
        .from('channel_memberships')
        .select('user_id, users(id, full_name, role)')
        .eq('channel_id', selectedChannelId);

      if (error) {
        console.error('Error fetching channel members:', error);
        toast({
          title: "Error",
          description: "Failed to fetch channel members",
          variant: "destructive",
        });
      } else {
        const members = data.map(item => ({
          id: item.users.id,
          full_name: item.users.full_name,
          role: item.users.role,
        }));
        setChannelMembers(members);
      }
    } catch (error) {
      console.error('Error fetching channel members:', error);
      toast({
        title: "Error",
        description: "Failed to fetch channel members",
        variant: "destructive",
      });
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role');

      if (error) {
        console.error('Error fetching available users:', error);
        toast({
          title: "Error",
          description: "Failed to fetch available users",
          variant: "destructive",
        });
      } else {
        setAvailableUsers(data || []);
      }
    } catch (error) {
      console.error('Error fetching available users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch available users",
        variant: "destructive",
      });
    }
  };

  const refetchChannelMembers = () => {
    if (channelId) {
      fetchChannelMembers(channelId);
    }
    fetchAvailableUsers();
  };

  useEffect(() => {
    if (channelId) {
      fetchChannelMembers(channelId);
    }
  }, [channelId]);

  useEffect(() => {
    fetchAvailableUsers();
  }, []);

  return { channelMembers, availableUsers, refetchChannelMembers };
};
