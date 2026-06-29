
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Channel } from '@/components/staff-notes/types';

export const useChannels = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Helper function to map database row to consistent format
  const mapRow = useCallback((row: any): Channel => {
    return {
      ...row,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
    };
  }, []);

  const fetchChannels = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching channels:', error);
        if (!options?.silent) {
          toast({
            title: "Error",
            description: "Failed to fetch channels",
            variant: "destructive",
          });
        }
      } else {
        const mappedChannels = (data || []).map(mapRow) as Channel[];
        setChannels(mappedChannels);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      if (!options?.silent) {
        toast({
          title: "Error",
          description: "Failed to fetch channels",
          variant: "destructive",
        });
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  // Real-time subscription for channels updates
  useEffect(() => {
    const channel = supabase
      .channel('channels-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels'
        },
        (payload) => {
          console.log('Real-time channels update:', payload);
          
          // Handle different events with incremental updates
          if (payload.eventType === 'INSERT' && payload.new) {
            const newChannel = mapRow(payload.new) as Channel;
            setChannels(prevChannels => {
              const existingIndex = prevChannels.findIndex(ch => ch.id === newChannel.id);
              if (existingIndex === -1) {
                return [newChannel, ...prevChannels];
              }
              return prevChannels;
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedChannel = mapRow(payload.new) as Channel;
            setChannels(prevChannels => 
              prevChannels.map(ch => 
                ch.id === updatedChannel.id ? updatedChannel : ch
              )
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setChannels(prevChannels => 
              prevChannels.filter(ch => ch.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { channels, loading, fetchChannels };
};
