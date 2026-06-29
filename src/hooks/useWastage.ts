import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { offlineAwareInsert } from '@/utils/offlineAwareSupabase';
import { useInstantData } from './useInstantData';
import { calculateCostPerPortion } from '@/lib/costCalculations';
import type { WastageLog } from '@/types/delivery-db';

interface UseWastageOptions {
  startDate?: string;
  endDate?: string;
}

export const useWastage = (options?: UseWastageOptions) => {
  const { pinUser } = useAuth();
  const companyId = pinUser?.company_id;
  const queryClient = useQueryClient();
  const { getInstantWastageLog, isDeviceLive } = useInstantData();

  // Try instant data first
  const instantResult = getInstantWastageLog();
  const hasInstantData = instantResult.isInstant && instantResult.data;

  const { data: fetchedWastageLogs = [], isLoading } = useQuery({
    queryKey: ['wastage_log', companyId, options?.startDate, options?.endDate],
    queryFn: async () => {
      if (!companyId) return [];
      
      // For bound devices, check cache first then use edge function
      const { isDeviceBound } = await import('@/utils/deviceBinding');
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData(['wastage_log', companyId, options?.startDate, options?.endDate]);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return cached as WastageLog[];
        }

        const { data, error } = await supabase.functions.invoke('pin-wastage-fetch', {
          body: { 
            companyId, 
            isDeviceBound: true,
            startDate: options?.startDate,
            endDate: options?.endDate
          }
        });

        if (error || !data?.success) {
          return cached || [];
        }

        return (data.wastageLogs || []) as WastageLog[];
      }

      // Web users: direct query
      let query = supabase
        .from('wastage_log' as any)
        .select(`
          *,
          ingredient:ingredients(
            name, 
            supplier, 
            known_as, 
            portion_type,
            cost_price,
            purchase_price,
            purchase_size,
            purchase_type,
            portion_size,
            units_per_purchase
          ),
          logged_by_user:users!wastage_log_logged_by_fkey(
            full_name,
            email
          )
        `)
        .eq('company_id', companyId);

      // Apply date filters
      if (options?.startDate) {
        query = query.gte('wastage_time', options.startDate);
      }
      if (options?.endDate) {
        query = query.lte('wastage_time', options.endDate);
      }

      query = query.order('wastage_time', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return data as any;
    },
    enabled: !!companyId,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 0,
  });

  // Only fall back to instant cache when NO date filter is applied
  const hasDateFilter = !!(options?.startDate || options?.endDate);
  const shouldUseInstantFallback = !hasDateFilter && hasInstantData;
  
  let wastageLogs: WastageLog[] = [];
  
  if (fetchedWastageLogs.length > 0) {
    // Use fresh fetched data
    wastageLogs = fetchedWastageLogs as WastageLog[];
  } else if (shouldUseInstantFallback) {
    // Only use instant cache as fallback when viewing "All Time"
    wastageLogs = instantResult.data as WastageLog[];
  } else if (hasDateFilter && hasInstantData) {
    // Apply client-side filtering to instant data if using it with filters
    wastageLogs = (instantResult.data as WastageLog[]).filter(log => {
      const logTime = new Date(log.wastage_time);
      const matchesStart = !options?.startDate || logTime >= new Date(options.startDate);
      const matchesEnd = !options?.endDate || logTime <= new Date(options.endDate);
      return matchesStart && matchesEnd;
    });
  }

  console.log('🔍 Wastage Query Debug:', {
    hasDateFilter,
    startDate: options?.startDate,
    endDate: options?.endDate,
    fetchedCount: fetchedWastageLogs.length,
    instantCount: (instantResult.data as WastageLog[] | undefined)?.length || 0,
    finalCount: wastageLogs.length,
    usingInstant: shouldUseInstantFallback,
  });

  const logWastage = useMutation({
    mutationFn: async (wastage: Omit<WastageLog, 'id' | 'created_at' | 'logged_by'>) => {
      const wastageData = await offlineAwareInsert('wastage_log', {
        ...wastage,
        logged_by: pinUser?.user_id,
      });

      // Also log to ingredient usage analytics if it's an ingredient
      if (wastage.ingredient_id && wastage.quantity) {
        try {
          const { offlineAwareInsert: insertAnalytics } = await import('@/utils/offlineAwareSupabase');
          await insertAnalytics('ingredient_usage_analytics', {
            company_id: companyId,
            ingredient_id: wastage.ingredient_id,
            date: new Date().toISOString().split('T')[0],
            quantity_used: 0,
            quantity_wasted: wastage.quantity,
            quantity_purchased: 0,
          });
        } catch (error) {
          console.error('Error updating analytics:', error);
        }
      }

      return wastageData;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['wastage_log', companyId] });
      queryClient.refetchQueries({ queryKey: ['ingredient_usage_analytics', companyId] });
      toast.success('Wastage logged successfully');
    },
    onError: (error) => {
      console.error('Error logging wastage:', error);
      toast.error('Failed to log wastage');
    },
  });

  const getWastageStats = (dateRange?: { start: string; end: string }) => {
    let filtered = wastageLogs || [];
    
    if (dateRange) {
      filtered = wastageLogs.filter(log => {
        const logDate = new Date(log.wastage_time);
        return logDate >= new Date(dateRange.start) && logDate <= new Date(dateRange.end);
      });
    }
    
    // Use stored historical cost only - never recalculate from current prices
    const getCostImpact = (log: WastageLog) => {
      return log.cost_impact || 0;
    };
    
    const totalCost = filtered.reduce((sum, log) => sum + getCostImpact(log), 0);
    const kitchenCost = filtered
      .filter(log => log.location === 'kitchen')
      .reduce((sum, log) => sum + getCostImpact(log), 0);
    const barCost = filtered
      .filter(log => log.location === 'bar')
      .reduce((sum, log) => sum + getCostImpact(log), 0);
    
    return {
      totalCost,
      kitchenCost,
      barCost,
      totalItems: filtered.length,
    };
  };

  return {
    wastageLogs,
    isLoading: hasInstantData ? false : isLoading,
    logWastage: logWastage.mutate,
    getWastageStats,
  };
};
