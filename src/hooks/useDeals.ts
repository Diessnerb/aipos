import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { getBoundCompany } from '@/utils/deviceBinding';

export interface Deal {
  id: string;
  company_id: string;
  day_of_week: number[];
  deal_name: string;
  description?: string;
  deal_type: string; // Changed from strict union to string to allow custom types
  discount_value?: number;
  n_value?: number;
  m_value?: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  menu_category_ids?: string[];
  menu_item_ids?: string[];
  applies_to: 'all' | 'categories' | 'items';
  custom_fields?: Record<string, any>; // Added for custom deal types
  created_at: string;
  updated_at: string;
}

export interface CreateDealData {
  day_of_week: number[];
  deal_name: string;
  description?: string;
  deal_type: string; // Changed from strict union to string
  discount_value?: number;
  n_value?: number;
  m_value?: number;
  start_time: string;
  end_time: string;
  is_active?: boolean;
  menu_category_ids?: string[];
  menu_item_ids?: string[];
  applies_to?: Deal['applies_to'];
  custom_fields?: Record<string, any>; // Added for custom deal types
}

// Helper function to convert day numbers to day names
export const getDayName = (dayNumber: number): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber] || '';
};

// Helper function to get short day names
export const getShortDayName = (dayNumber: number): string => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dayNumber] || '';
};

// Helper function to check if deal is active on a specific day
export const isDealActiveOnDay = (deal: Deal, dayNumber: number): boolean => {
  return deal.is_active && deal.day_of_week.includes(dayNumber);
};

export const useDeals = () => {
  const { companyId, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deviceLive = useDeviceLiveLayer();

  // Get instant data from cache when device is live
  const instantDeals = deviceLive && companyId ? 
    queryClient.getQueryData<Deal[]>(['deals', companyId]) || [] : [];
  
  // Local state to mirror deals when device live is active
  const [localDeals, setLocalDeals] = useState<Deal[]>(instantDeals);

  // Keep local deals in sync with cache
  useEffect(() => {
    if (deviceLive && companyId) {
      const cached = queryClient.getQueryData<Deal[]>(['deals', companyId]) || [];
      setLocalDeals(cached);
    }
  }, [deviceLive, companyId, queryClient]);

  const dealsQuery = useQuery({
    queryKey: ['deals', companyId],
    queryFn: async (): Promise<Deal[]> => {
      if (!companyId) return [];

      // Skip network call if device is live and cache exists
      if (deviceLive && instantDeals.length > 0) {
        console.log('⚡ useDeals: Using instant cached data');
        return instantDeals;
      }

      // For bound devices, check cache first then use edge function
      const { isDeviceBound } = await import('@/utils/deviceBinding');
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData<Deal[]>(['deals', companyId]);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return cached;
        }

        const { data, error } = await supabase.functions.invoke('pin-deals-fetch', {
          body: { companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          return cached || [];
        }

        return (data.deals || []) as Deal[];
      }

      // Web users: direct query
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('company_id', companyId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching deals:', error);
        throw error;
      }

      return (data || []) as Deal[];
    },
    enabled: !deviceLive && !authLoading && !!companyId,
    initialData: instantDeals.length > 0 ? instantDeals : undefined,
    staleTime: deviceLive ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000,
    refetchOnWindowFocus: !deviceLive,
    refetchOnMount: !deviceLive,
    placeholderData: (prev) => prev,
    retry: 0,
  });

  const createDealMutation = useMutation({
    mutationFn: async (dealData: CreateDealData): Promise<Deal> => {
      // Use device binding company_id as primary source (always valid UUID on bound devices)
      const bound = getBoundCompany();
      const effectiveCompanyId = bound?.company_id || companyId;

      if (!effectiveCompanyId) {
        console.error('createDeal: No company_id available', { 
          boundCompanyId: bound?.company_id, 
          authCompanyId: companyId 
        });
        throw new Error('Company ID is required to create a deal');
      }

      console.log('createDeal: Using company_id from', bound?.company_id ? 'device binding' : 'auth', effectiveCompanyId);

      const insertData = {
        ...dealData,
        company_id: effectiveCompanyId,
        is_active: dealData.is_active ?? true,
        applies_to: dealData.applies_to ?? 'all',
        custom_fields: dealData.custom_fields ?? {}
      };

      const { data, error } = await supabase
        .from('deals')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data as Deal;
    },
    onSuccess: (newDeal) => {
      const sortedDeals = (prev: Deal[] = []) => 
        [...prev, newDeal].sort((a, b) => {
          const aMinDay = Math.min(...a.day_of_week);
          const bMinDay = Math.min(...b.day_of_week);
          return aMinDay - bMinDay || a.start_time.localeCompare(b.start_time);
        });
      
      // Update cache
      queryClient.setQueryData(['deals', companyId], sortedDeals);
      
      // Update local state for instant UI update when device live
      if (deviceLive) {
        setLocalDeals(prev => sortedDeals(prev));
      }
      
      toast({ title: "Success", description: "Deal created successfully" });
    },
    onError: (error) => {
      console.error('Error creating deal:', error);
      toast({ title: "Error", description: "Failed to create deal", variant: "destructive" });
    }
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, dealData }: { id: string; dealData: Partial<CreateDealData> }): Promise<Deal> => {
      if (!id) {
        throw new Error('Deal ID is required for updates');
      }

      const { data, error } = await supabase
        .from('deals')
        .update(dealData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Deal;
    },
    onSuccess: (updatedDeal) => {
      queryClient.setQueryData(['deals', companyId], (prev: Deal[] = []) =>
        prev.map(deal => deal.id === updatedDeal.id ? updatedDeal : deal)
      );
      
      // Update local state for instant UI update when device live
      if (deviceLive) {
        setLocalDeals(prev => prev.map(deal => deal.id === updatedDeal.id ? updatedDeal : deal));
      }
      
      toast({ title: "Success", description: "Deal updated successfully" });
    },
    onError: (error) => {
      console.error('Error updating deal:', error);
      toast({ title: "Error", description: "Failed to update deal", variant: "destructive" });
    }
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('deals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData(['deals', companyId], (prev: Deal[] = []) =>
        prev.filter(deal => deal.id !== deletedId)
      );
      toast({ title: "Success", description: "Deal deleted successfully" });
    },
    onError: (error) => {
      console.error('Error deleting deal:', error);
      toast({ title: "Error", description: "Failed to delete deal", variant: "destructive" });
    }
  });

  // Set up real-time subscription (only if device live layer is not active)
  useEffect(() => {
    if (!companyId || deviceLive) return;

    const channel = supabase
      .channel(`deals-changes-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deals',
          filter: `company_id=eq.${companyId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['deals', companyId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient, deviceLive]);

  return {
    deals: deviceLive ? localDeals : (dealsQuery.data || []),
    loading: deviceLive ? false : dealsQuery.isLoading,
    error: dealsQuery.error?.message,
    createDeal: createDealMutation.mutateAsync,
    updateDeal: (id: string, dealData: Partial<CreateDealData>) => 
      updateDealMutation.mutateAsync({ id, dealData }),
    deleteDeal: deleteDealMutation.mutateAsync,
    toggleDealActive: (id: string, isActive: boolean) => 
      updateDealMutation.mutateAsync({ id, dealData: { is_active: isActive } }),
    refetch: dealsQuery.refetch,
    isCreating: createDealMutation.isPending,
    isUpdating: updateDealMutation.isPending,
    isDeleting: deleteDealMutation.isPending,
  };
};