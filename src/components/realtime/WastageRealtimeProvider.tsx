import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { supabase } from '@/integrations/supabase/client';

export const WastageRealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const { isActive: deviceLive } = useDeviceLiveLayer();

  useEffect(() => {
    // Skip if device live layer is active (DeviceDataManager handles it)
    if (deviceLive) {
      console.log('📱 Wastage realtime: Skipping - device layer active');
      return;
    }

    if (!companyId) return;

    console.log('🌐 Wastage realtime: Setting up web user subscription');
    const channel = supabase
      .channel('wastage-realtime-web')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wastage_log',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('🔄 Wastage realtime event:', payload);
          queryClient.refetchQueries({ queryKey: ['wastage_log', companyId] });
          queryClient.refetchQueries({ queryKey: ['ingredient_usage_analytics', companyId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient, deviceLive]);

  return <>{children}</>;
};
