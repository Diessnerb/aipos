import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { getRawPin } from '@/utils/pinAuth';

export const useDataPrefetch = () => {
  const { user, companyId, pinUser } = useAuth();

  const prefetchData = async () => {
    // Require either user auth or PIN auth with company
    if ((!user && !pinUser) || !companyId) {
      console.log('🚀 Skipping prefetch - no auth or company ID');
      return;
    }

    console.log('🚀 Prefetching data for company:', companyId, 'pinMode:', !!pinUser);

    try {
      // In PIN mode, use edge functions for data access
      if (pinUser) {
        const rawPin = getRawPin();
        if (!rawPin) {
          console.warn('🚀 PIN mode but no raw PIN available');
          return;
        }

        const { isDeviceBound } = await import('@/utils/deviceBinding');
        const bound = isDeviceBound();

        const [reservationsResult, customersResult, settingsResult] = await Promise.allSettled([
          supabase.functions.invoke('pin-reservations-fetch', {
            body: { pin: rawPin, companyId, isDeviceBound: bound }
          }),
          supabase.functions.invoke('pin-customers-fetch', {
            body: { pin: rawPin, companyId }
          }),
          supabase.functions.invoke('company-settings-get', {
            body: {
              pin: rawPin,
              companyId: companyId,
              isAuthenticatedAdmin: true
            }
          })
        ]);

        console.log('🚀 PIN prefetch results:', {
          reservations: reservationsResult.status === 'fulfilled' ? 'loaded' : 'failed',
          customers: customersResult.status === 'fulfilled' ? 'loaded' : 'failed',
          settings: settingsResult.status === 'fulfilled' ? 'loaded' : 'failed'
        });

        return;
      }

      // Standard prefetch for authenticated users
      const [tablesResult, reservationsResult, menuItemsResult, settingsResult] = await Promise.allSettled([
        supabase
          .from('tables')
          .select('*')
          .eq('is_active', true)
          .eq('company_id', companyId)
          .order('table_number'),
        
        supabase
          .from('reservations')
          .select('*')
          .eq('company_id', companyId)
          .gte('date', new Date().toISOString().split('T')[0])
          .order('date', { ascending: true }),
        
        supabase
          .from('menu_items')
          .select('*, menu_categories(*)')
          .eq('company_id', companyId)
          .order('display_order'),
        
        // Use company-settings-get edge function for reliable settings access
        supabase.functions.invoke('company-settings-get', {
          body: {
            pin: getRawPin(),
            companyId: companyId,
            isAuthenticatedAdmin: true
          }
        })
      ]);

      console.log('🚀 Standard prefetch results:', {
        tables: tablesResult.status === 'fulfilled' ? tablesResult.value.data?.length : 'failed',
        reservations: reservationsResult.status === 'fulfilled' ? reservationsResult.value.data?.length : 'failed',
        menuItems: menuItemsResult.status === 'fulfilled' ? menuItemsResult.value.data?.length : 'failed',
        settings: settingsResult.status === 'fulfilled' ? 'loaded' : 'failed'
      });
    } catch (error) {
      console.error('🚀 Error prefetching data:', error);
    }
  };

  return { prefetchData };
};