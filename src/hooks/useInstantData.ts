import { useQueryClient } from '@tanstack/react-query';
import { useDeviceLiveLayer } from './useDeviceLiveLayer';
import { useAuth } from '@/components/AuthProvider';

/**
 * Hook for instant data access when device is bound
 * Returns cached data immediately without loading states
 */
export const useInstantData = () => {
  const queryClient = useQueryClient();
  const deviceLive = useDeviceLiveLayer();
  const { companyId } = useAuth();

  const getInstantData = <T>(queryKey: (string | null)[]): {
    data: T | undefined;
    isInstant: boolean;
  } => {
    if (!deviceLive?.isActive || !companyId) {
      console.log(`⚠️ useInstantData: Device not live for ${queryKey[0]}`, { 
        isActive: deviceLive?.isActive, 
        companyId 
      });
      return { data: undefined, isInstant: false };
    }

    const cached = queryClient.getQueryData(queryKey) as any;
    
    // Expect STANDARD cache shapes only
    let data: T | undefined;
    if (cached) {
      // For reservations: { date, reservations: Reservation[], ...}
      if (cached.reservations && Array.isArray(cached.reservations)) {
        data = cached.reservations as T;
      }
      // For plain arrays (tables)
      else if (Array.isArray(cached)) {
        data = cached as T;
      }
      // For other data with standard shape
      else if (cached.data) {
        data = cached.data as T;
      }
    }
    
    const hasData = data !== undefined;
    const tableKey = queryKey[0];
    
    if (hasData) {
      const count = Array.isArray(data) ? data.length : 'N/A';
      console.log(`⚡ useInstantData: Returning instant cached data for ${tableKey} (${count} items)`);
    } else {
      console.log(`⚠️ useInstantData: No cached data for ${tableKey}, will fetch from Supabase`);
    }
    
    return { 
      data, 
      isInstant: hasData // Only return instant if we actually have data
    };
  };

  const getInstantReservations = (date?: string) => {
    if (date) {
      return getInstantData(['reservations-date', companyId, date]);
    }
    return getInstantData(['reservations', companyId]);
  };

  const getInstantTables = () => getInstantData(['tables', companyId]);
  
  const getInstantMenuItems = () => getInstantData(['menu_items', companyId]);
  
  const getInstantCustomers = () => getInstantData(['customers', companyId]);
  
  const getInstantUsers = () => getInstantData(['users', companyId]);
  
  const getInstantSettings = () => getInstantData(['company_settings', companyId]);
  
  const getInstantIngredients = () => getInstantData(['ingredients', companyId]);

  const getInstantSuppliers = () => getInstantData(['suppliers', companyId]);

  const getInstantDeliveryOrders = () => getInstantData(['delivery_orders', companyId]);

  const getInstantDeliveryOrderItems = () => getInstantData(['delivery_order_items', companyId]);

  const getInstantWastageLog = () => getInstantData(['wastage_log', companyId]);

  const getInstantDeliverySettings = () => getInstantData(['delivery_settings', companyId]);

  return {
    getInstantReservations,
    getInstantTables,
    getInstantMenuItems,
    getInstantCustomers,
    getInstantUsers,
    getInstantSettings,
    getInstantIngredients,
    getInstantSuppliers,
    getInstantDeliveryOrders,
    getInstantDeliveryOrderItems,
    getInstantWastageLog,
    getInstantDeliverySettings,
    isDeviceLive: deviceLive
  };
};