import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { isDeviceBound } from '@/utils/deviceBinding';

export const useReservationAnalytics = () => {
  const { pinUser } = useAuth();
  const companyId = pinUser?.company_id;
  const queryClient = useQueryClient();

  // Total reservations
  const { data: totalReservations = 0, isLoading: totalLoading } = useQuery({
    queryKey: ['total-reservations', companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData(['total-reservations', companyId]) as number;
        if (typeof cached === 'number') {
          return cached;
        }
        
        const { data, error } = await supabase.functions.invoke('pin-analytics-reservations-fetch', {
          body: { companyId, isDeviceBound: true }
        });
        
        if (error || !data?.success) {
          console.error('❌ Failed to fetch reservations analytics:', error);
          return cached || 0;
        }
        
        return data.totalReservations || 0;
      }
      
      const { count, error } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .neq('status', 'cancelled');
      
      if (error) {
        console.error('Error fetching total reservations:', error);
        return 0;
      }
      
      return count || 0;
    },
    enabled: !!companyId,
    retry: 0,
  });

  // Monthly reservations
  const { data: monthlyReservations = 0, isLoading: monthlyLoading } = useQuery({
    queryKey: ['monthly-reservations', companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData(['monthly-reservations', companyId]) as number;
        if (typeof cached === 'number') {
          return cached;
        }
        
        const { data, error } = await supabase.functions.invoke('pin-analytics-reservations-fetch', {
          body: { companyId, isDeviceBound: true }
        });
        
        if (error || !data?.success) {
          console.error('❌ Failed to fetch reservations analytics:', error);
          return cached || 0;
        }
        
        return data.monthlyReservations || 0;
      }
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const { count, error } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString())
        .neq('status', 'cancelled');
      
      if (error) {
        console.error('Error fetching monthly reservations:', error);
        return 0;
      }
      
      return count || 0;
    },
    enabled: !!companyId,
    retry: 0,
  });

  // Total customers
  const { data: totalCustomers = 0, isLoading: customersLoading } = useQuery({
    queryKey: ['total-customers', companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData(['total-customers', companyId]) as number;
        if (typeof cached === 'number') {
          return cached;
        }
        
        const { data, error } = await supabase.functions.invoke('pin-analytics-reservations-fetch', {
          body: { companyId, isDeviceBound: true }
        });
        
        if (error || !data?.success) {
          console.error('❌ Failed to fetch customer analytics:', error);
          return cached || 0;
        }
        
        return data.totalCustomers || 0;
      }
      
      const { count, error } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);
      
      if (error) {
        console.error('Error fetching customers:', error);
        return 0;
      }
      
      return count || 0;
    },
    enabled: !!companyId,
    retry: 0,
  });

  // Weekly new customers
  const { data: weeklyNewCustomers = 0, isLoading: weeklyLoading } = useQuery({
    queryKey: ['weekly-new-customers', companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData(['weekly-new-customers', companyId]) as number;
        if (typeof cached === 'number') {
          return cached;
        }
        
        const { data, error } = await supabase.functions.invoke('pin-analytics-reservations-fetch', {
          body: { companyId, isDeviceBound: true }
        });
        
        if (error || !data?.success) {
          console.error('❌ Failed to fetch weekly customer analytics:', error);
          return cached || 0;
        }
        
        return data.weeklyNewCustomers || 0;
      }
      
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfWeekDate = startOfWeek.toISOString().split('T')[0];
      
      const { count, error } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('last_visit', startOfWeekDate);
      
      if (error) {
        console.error('Error fetching weekly customers:', error);
        return 0;
      }
      
      return count || 0;
    },
    enabled: !!companyId,
    retry: 0,
  });

  const isLoading = totalLoading || monthlyLoading || customersLoading || weeklyLoading;

  return {
    totalReservations,
    monthlyReservations,
    totalCustomers,
    weeklyNewCustomers,
    isLoading,
  };
};
