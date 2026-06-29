import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProductLink } from '@/types/productLinks';
import { useDeviceLiveLayer } from './useDeviceLiveLayer';
import { useAuth } from '@/components/AuthProvider';

export const useMenuItemProductLinks = (companyId: string | null) => {
  const queryClient = useQueryClient();
  const { isActive: deviceLive } = useDeviceLiveLayer();
  const { loading: authLoading } = useAuth();

  // Get instant data from cache when device is live
  const instantData = deviceLive && companyId ? 
    queryClient.getQueryData<Record<string, ProductLink[]>>(['menu-item-product-links', companyId]) || {} : {};

  console.log('🎣 [PRODUCT-LINKS-HOOK] Hook called with:', {
    companyId,
    deviceLive,
    authLoading,
    instantDataKeys: Object.keys(instantData).length
  });

  return useQuery({
    queryKey: ['menu-item-product-links', companyId],
    queryFn: async () => {
      console.log('📊 [PRODUCT-LINKS-HOOK] Starting fetch for company:', companyId);
      
      if (!companyId) {
        console.warn('⚠️ [PRODUCT-LINKS-HOOK] No company ID provided');
        return {};
      }

      const { data, error } = await supabase
        .from('product_links')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true);

      console.log('📦 [PRODUCT-LINKS-HOOK] Raw data received:', {
        totalRecords: data?.length || 0,
        hasError: !!error,
        error: error,
        sampleData: data?.slice(0, 3)
      });

      if (error) {
        console.error('❌ [PRODUCT-LINKS-HOOK] Error fetching:', error);
        throw error;
      }

      // Group by menu_item_id for easy lookup
      const grouped: Record<string, ProductLink[]> = {};
      data?.forEach((link) => {
        if (!grouped[link.menu_item_id]) {
          grouped[link.menu_item_id] = [];
        }
        grouped[link.menu_item_id].push(link as ProductLink);
      });

      console.log('🗂️ [PRODUCT-LINKS-HOOK] Grouped result:', {
        totalMenuItems: Object.keys(grouped).length,
        menuItemIds: Object.keys(grouped),
        itemsWithCounts: Object.entries(grouped).map(([id, links]) => ({
          menuItemId: id,
          linkCount: links.length,
          optionNames: links.map(l => l.option_name)
        }))
      });

      return grouped;
    },
    enabled: !deviceLive && !authLoading && !!companyId,
    initialData: Object.keys(instantData).length > 0 ? instantData : undefined,
    staleTime: deviceLive ? Infinity : 30000,
  });
};
