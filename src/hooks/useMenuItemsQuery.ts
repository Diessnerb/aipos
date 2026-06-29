import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyId } from './useCompanyId';
import { isDeviceBound, getBoundCompany } from '@/utils/deviceBinding';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { getCurrentPinUser } from '@/utils/pinAuth';

export const useMenuItemsQuery = () => {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const { isActive: deviceLive } = useDeviceLiveLayer();
  const bound = isDeviceBound();
  
  const query = useQuery({
    queryKey: ['menu_items', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('🏪 No companyId available for menu items query');
        return [];
      }

      // PRIORITY 1: Check cache first (instant for bound devices)
      if (bound) {
        const cachedItems = queryClient.getQueryData(['menu_items', companyId]) as any[];
        if (cachedItems && Array.isArray(cachedItems) && cachedItems.length > 0) {
          console.log('📦 useMenuItems: Using cached menu items:', cachedItems.length);
          return cachedItems;
        }
        
        // PRIORITY 2: Call edge function with isDeviceBound flag
        console.log('🌐 useMenuItems: Fetching via edge function (isDeviceBound: true)');
        const { data, error } = await supabase.functions.invoke('pin-menu-items-fetch', {
          body: { companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ useMenuItems: Edge function failed:', error);
          // Keep existing cache if edge fails
          return cachedItems || [];
        }
        
        // Don't overwrite cache if edge returns empty but we have cache
        if ((!data.items || data.items.length === 0) && cachedItems && cachedItems.length > 0) {
          console.log('🛡️ Keeping existing cache; edge returned 0 items');
          return cachedItems;
        }
        
        console.log('✅ Menu items fetched via edge function:', data.items?.length || 0);
        return data.items || [];
      }

      // PRIORITY 3: For authenticated web users, use direct query
      console.log('🏪 Fetching menu items via direct query (authenticated user):', companyId);

      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          menu_categories!inner (
            category_type
          )
        `)
        .eq('company_id', companyId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('🏪 Menu items query error:', error);
        throw error;
      }

      // Transform data to flatten category_type onto menu item
      const transformedData = data?.map(({ menu_categories, ...item }: any) => ({
        ...item,
        category_type: menu_categories?.category_type || 'mains'
      })) || [];

      return transformedData;
    },
    enabled: !!companyId && companyId !== 'undefined',
    staleTime: deviceLive ? Infinity : 10 * 60 * 1000,
    refetchOnWindowFocus: !deviceLive,
    refetchOnMount: !deviceLive,
  });

  // Set up real-time subscription (only if not bound device)
  useEffect(() => {
    if (!companyId || bound || deviceLive) return;

    console.log('🏪 Setting up real-time menu items subscription');

    const channel = supabase
      .channel('menu-items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('🏪 Real-time menu item update:', payload);
          
          const currentData = queryClient.getQueryData<any[]>(['menu_items', companyId]) || [];
          
          if (payload.eventType === 'INSERT' && payload.new) {
            queryClient.setQueryData(['menu_items', companyId], [...currentData, payload.new]);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedData = currentData.map(item => 
              item.id === payload.new.id ? payload.new : item
            );
            queryClient.setQueryData(['menu_items', companyId], updatedData);
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const filteredData = currentData.filter(item => item.id !== payload.old.id);
            queryClient.setQueryData(['menu_items', companyId], filteredData);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🏪 Cleaning up menu items subscription');
      supabase.removeChannel(channel);
    };
  }, [companyId, bound, queryClient, deviceLive]);

  return {
    menuItems: query.data || [],
    loading: deviceLive ? false : query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
};