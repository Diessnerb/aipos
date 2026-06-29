import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyId } from '@/hooks/useCompanyId';
import { DeviceDataManager } from '@/device/DeviceDataManager';

interface KitchenReadyNotification {
  id: string;
  type: 'order' | 'course' | 'service' | 'message';
  displayName: string;
  courseType?: 'starter' | 'main' | 'dessert';
  message?: string;
  readyAt: string;
  orderId: string;
}

export const useKitchenReadyNotifications = () => {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  
  // Check if device is in offline mode to pause refetching
  const { offlineMode } = DeviceDataManager.getDebugInfo();

  // Fetch non-reservation orders with kitchen_status='ready'
  const { data: readyOrders = [] } = useQuery({
    queryKey: ['kitchen-ready-orders', companyId],
    queryFn: async () => {
      console.log('[KITCHEN-HOOK] Fetching ready orders...', { companyId });
      
      const { data, error } = await supabase
        .from('orders')
        .select('id, external_pos_order_id, table_number, customer_name, created_at, kitchen_status')
        .eq('company_id', companyId!)
        .eq('kitchen_status', 'ready')
        .is('reservation_id', null)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[KITCHEN-HOOK] Failed to fetch ready orders:', error);
        throw error;
      }

      console.log('[KITCHEN-HOOK] Ready orders fetched:', {
        count: data.length,
        ids: data.map(o => ({ id: o.id.slice(0, 8), status: o.kitchen_status }))
      });

      return data.map(order => ({
        id: order.id,
        type: 'order' as const,
        displayName: order.table_number 
          ? `Table ${order.table_number}` 
          : order.customer_name || `Order #${order.external_pos_order_id || order.id.slice(0, 6)}`,
        readyAt: order.created_at,
        orderId: order.id,
      }));
    },
    enabled: !!companyId,
    refetchInterval: offlineMode ? false : 3000, // Pause refetching when offline
  });

  // Fetch reservations with "ready-in-kitchen" statuses
  const { data: readyCourses = [] } = useQuery({
    queryKey: ['kitchen-ready-courses', companyId],
    queryFn: async () => {
      console.log('[KITCHEN-HOOK] Fetching ready courses...', { companyId });
      
      const { data, error } = await supabase
        .from('reservations')
        .select('id, customer_name, table_number, table_numbers, status, created_at')
        .eq('company_id', companyId!)
        .in('status', [
          'starters-ready-in-kitchen',
          'mains-ready-in-kitchen',
          'desserts-ready-in-kitchen'
        ])
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[KITCHEN-HOOK] Failed to fetch ready courses:', error);
        throw error;
      }

      console.log('[KITCHEN-HOOK] Ready courses fetched:', {
        count: data.length,
        ids: data.map(r => ({ id: r.id.slice(0, 8), status: r.status }))
      });

      return data.map(reservation => {
        let courseType: 'starter' | 'main' | 'dessert' = 'main';
        if (reservation.status?.includes('starters')) courseType = 'starter';
        if (reservation.status?.includes('desserts')) courseType = 'dessert';

        const tableName = reservation.table_number 
          ? `Table ${reservation.table_number}`
          : reservation.table_numbers?.length 
            ? `Tables ${reservation.table_numbers.join(', ')}`
            : reservation.customer_name || 'Unknown';

        return {
          id: reservation.id,
          type: 'course' as const,
          displayName: tableName,
          courseType,
          readyAt: reservation.created_at,
          orderId: reservation.id,
        };
      });
    },
    enabled: !!companyId,
    refetchInterval: offlineMode ? false : 3000, // Pause refetching when offline
  });

  // Fetch active kitchen service requests
  const { data: serviceRequests = [] } = useQuery({
    queryKey: ['kitchen-service-requests', companyId],
    queryFn: async () => {
      console.log('[KITCHEN-HOOK] Fetching service requests...', { companyId });
      
      const { data, error } = await supabase
        .from('kitchen_service_requests')
        .select('*')
        .eq('company_id', companyId!)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[KITCHEN-HOOK] Failed to fetch service requests:', error);
        throw error;
      }

      console.log('[KITCHEN-HOOK] Service requests fetched:', {
        count: data.length,
        types: data.map(r => ({ id: r.id.slice(0, 8), type: r.type }))
      });

      return data.map(request => ({
        id: request.id,
        type: request.type as 'service' | 'message',
        displayName: request.type === 'service' ? 'Service Request' : 'Kitchen Message',
        message: request.message || undefined,
        readyAt: request.created_at,
        orderId: request.id,
      }));
    },
    enabled: !!companyId,
    refetchInterval: offlineMode ? false : 3000, // Pause refetching when offline
  });

  // Combine and sort by ready time
  const allNotifications = [...readyOrders, ...readyCourses, ...serviceRequests].sort(
    (a, b) => new Date(a.readyAt).getTime() - new Date(b.readyAt).getTime()
  );

  console.log('[KITCHEN-HOOK] Combined notifications:', {
    total: allNotifications.length,
    orders: readyOrders.length,
    courses: readyCourses.length,
    serviceRequests: serviceRequests.length,
    first3: allNotifications.slice(0, 3).map(n => ({ 
      id: n.id.slice(0, 8), 
      type: n.type, 
      displayName: n.displayName 
    }))
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!companyId) return;

    console.log('[KITCHEN-HOOK] Setting up realtime subscriptions...', { companyId });

    const ordersChannel = supabase
      .channel('pos-kitchen-ready-orders')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('[KITCHEN-HOOK] Orders realtime update:', payload);
          queryClient.invalidateQueries({ queryKey: ['kitchen-ready-orders'] });
        }
      )
      .subscribe();

    const reservationsChannel = supabase
      .channel('pos-kitchen-ready-courses')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reservations',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('[KITCHEN-HOOK] Reservations realtime update:', payload);
          queryClient.invalidateQueries({ queryKey: ['kitchen-ready-courses'] });
        }
      )
      .subscribe();

    const serviceRequestsChannel = supabase
      .channel('pos-kitchen-service-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kitchen_service_requests',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('[KITCHEN-HOOK] Service requests realtime update:', payload);
          queryClient.invalidateQueries({ queryKey: ['kitchen-service-requests'] });
        }
      )
      .subscribe();

    return () => {
      console.log('[KITCHEN-HOOK] Cleaning up realtime subscriptions...');
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(reservationsChannel);
      supabase.removeChannel(serviceRequestsChannel);
    };
  }, [companyId, queryClient]);

  return { notifications: allNotifications };
};
