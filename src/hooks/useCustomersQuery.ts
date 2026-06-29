import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyId } from './useCompanyId';
import { isDeviceBound } from '@/utils/deviceBinding';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';

export const useCustomersQuery = () => {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const { isActive: deviceLive } = useDeviceLiveLayer();
  const bound = isDeviceBound();

  const query = useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('👥 No companyId available for customers query');
        return [];
      }

      // PRIORITY 1: Check cache first for bound devices
      if (bound) {
        const cached = queryClient.getQueryData(['customers', companyId]) as any[];
        if (cached && Array.isArray(cached) && cached.length > 0) {
          console.log('📦 useCustomers: Using cached customers:', cached.length);
          return cached;
        }

        // PRIORITY 2: Call edge function with isDeviceBound flag
        console.log('🌐 useCustomers: Fetching via edge function (isDeviceBound: true)');
        const { data, error } = await supabase.functions.invoke('pin-customers-fetch', {
          body: { companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ useCustomers: Edge function failed:', error);
          return cached || [];
        }

        // Don't overwrite cache if edge returns empty
        if ((!data.customers || data.customers.length === 0) && cached && cached.length > 0) {
          console.log('🛡️ Keeping existing cache; edge returned 0 customers');
          return cached;
        }

        console.log('✅ Customers fetched via edge function:', data.customers?.length || 0);
        return data.customers || [];
      }

      // PRIORITY 3: Direct query for authenticated web users only
      console.log('👥 Fetching customers via direct query (authenticated user)');
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (error) {
        console.error('👥 Customers query error:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!companyId && companyId !== 'undefined',
    staleTime: deviceLive ? Infinity : 10 * 60 * 1000,
    refetchOnWindowFocus: !deviceLive,
    refetchOnMount: !deviceLive,
  });

  // Set up real-time subscription (only if not device live layer)
  useEffect(() => {
    if (!companyId || bound || deviceLive) return;

    console.log('🏪 Setting up real-time customers subscription');

    const channel = supabase
      .channel('customers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('🏪 Real-time customer update:', payload);
          
          const currentData = queryClient.getQueryData<any[]>(['customers', companyId]) || [];
          
          if (payload.eventType === 'INSERT' && payload.new) {
            queryClient.setQueryData(['customers', companyId], [...currentData, payload.new]);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedData = currentData.map(item => 
              item.id === payload.new.id ? payload.new : item
            );
            queryClient.setQueryData(['customers', companyId], updatedData);
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const filteredData = currentData.filter(item => item.id !== payload.old.id);
            queryClient.setQueryData(['customers', companyId], filteredData);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🏪 Cleaning up customers subscription');
      supabase.removeChannel(channel);
    };
  }, [companyId, bound, queryClient, deviceLive]);

  return {
    customers: query.data || [],
    loading: deviceLive ? false : query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
};