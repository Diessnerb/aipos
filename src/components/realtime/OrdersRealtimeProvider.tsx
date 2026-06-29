import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { supabase } from '@/integrations/supabase/client';
import { LocalPeerSync } from '@/device/LocalPeerSync';
import { SyncCoordinator } from '@/device/SyncCoordinator';

export const OrdersRealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const { isActive: deviceLive } = useDeviceLiveLayer();

  useEffect(() => {
    // Skip if device live layer is active (DeviceDataManager handles it)
    if (deviceLive) {
      console.log('📱 Orders realtime: Skipping - device layer active');
      return;
    }

    if (!companyId) return;

    console.log('🌐 Orders realtime: Setting up web user subscription');
    const channel = supabase
      .channel('orders-realtime-web')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pos-orders'] });
          queryClient.invalidateQueries({ queryKey: ['open-tabs'] });
          queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
          queryClient.invalidateQueries({ queryKey: ['orders', companyId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient, deviceLive]);

  // Setup P2P sync if device is bound
  useEffect(() => {
    if (!deviceLive) return;
    
    // Initialize sync coordinator
    SyncCoordinator.initialize();
    
    // Listen for P2P mutations
    const unsubscribe = LocalPeerSync.onMessage((message) => {
      console.log('📡 P2P mutation received:', message);
      
      // Invalidate relevant queries
      if (message.mutation.table === 'orders') {
        queryClient.invalidateQueries({ queryKey: ['pos-orders'] });
        queryClient.invalidateQueries({ queryKey: ['open-tabs'] });
        queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
        queryClient.invalidateQueries({ queryKey: ['orders', companyId] });
      } else if (message.mutation.table === 'reservations') {
        queryClient.invalidateQueries({ queryKey: ['reservations'] });
        queryClient.invalidateQueries({ queryKey: ['reservations-date'] });
      } else {
        // Generic invalidation
        queryClient.invalidateQueries({ queryKey: [message.mutation.table] });
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [deviceLive, companyId, queryClient]);

  return <>{children}</>;
};
