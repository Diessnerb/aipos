import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { isDeviceBound } from '@/utils/deviceBinding';

interface DailyAnalytics {
  analytics_date: string;
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  peak_hour: number;
  peak_hour_revenue: number;
}

interface TableMetrics {
  table_number: number;
  total_revenue: number;
  total_orders: number;
  utilization_rate: number;
  turnover_count: number;
  average_duration_minutes: number;
}

export const useRevenueAnalytics = () => {
  const { pinUser } = useAuth();
  const companyId = pinUser?.company_id;
  const queryClient = useQueryClient();
  
  // Try to get instant cached data first
  const cachedAnalytics = queryClient.getQueryData(['analytics', companyId]) as DailyAnalytics[];
  const cachedTableMetrics = queryClient.getQueryData(['table_metrics', companyId]) as TableMetrics[];
  
  const hasInstantData = !!cachedAnalytics && !!cachedTableMetrics;

  // Fetch daily analytics
  const { data: dailyData = [], isLoading: isDailyLoading } = useQuery({
    queryKey: ['analytics', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // For bound devices, check cache first then use edge function
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData(['analytics', companyId]) as DailyAnalytics[];
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return cached;
        }
        
        const { data, error } = await supabase.functions.invoke('pin-analytics-revenue-fetch', {
          body: { companyId, isDeviceBound: true }
        });
        
        if (error || !data?.success) {
          console.error('❌ Failed to fetch analytics via edge function:', error);
          return cached || [];
        }
        
        return data.dailyAnalytics || [];
      }
      
      // Web users: keep existing direct query
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from('daily_revenue_analytics')
        .select('*')
        .gte('analytics_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('analytics_date', { ascending: true });
      return data || [];
    },
    enabled: !!companyId && !hasInstantData,
    initialData: () => cachedAnalytics || [],
    retry: 0,
  });

  // Fetch table metrics
  const { data: tableData = [], isLoading: isTableLoading } = useQuery({
    queryKey: ['table_metrics', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // For bound devices, check cache first then use edge function
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData(['table_metrics', companyId]) as TableMetrics[];
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return cached;
        }
        
        const { data, error } = await supabase.functions.invoke('pin-analytics-revenue-fetch', {
          body: { companyId, isDeviceBound: true }
        });
        
        if (error || !data?.success) {
          console.error('❌ Failed to fetch table metrics via edge function:', error);
          return cached || [];
        }
        
        return data.tableMetrics || [];
      }
      
      // Web users: keep existing direct query
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('table_performance_metrics')
        .select('*')
        .eq('metrics_date', today)
        .order('total_revenue', { ascending: false });
      return data || [];
    },
    enabled: !!companyId && !hasInstantData,
    initialData: () => cachedTableMetrics || [],
    retry: 0,
  });

  const dailyAnalytics = hasInstantData ? cachedAnalytics : dailyData;
  const tableMetrics = hasInstantData ? cachedTableMetrics : tableData;
  const isLoading = hasInstantData ? false : (isDailyLoading || isTableLoading);

  // Calculate summary metrics
  const today = new Date().toISOString().split('T')[0];
  const todayAnalytics = dailyAnalytics?.find(d => d.analytics_date === today);
  
  const totalRevenue = todayAnalytics?.total_revenue || 0;
  const totalOrders = todayAnalytics?.total_orders || 0;
  const averageOrderValue = todayAnalytics?.average_order_value || 0;
  const peakHours = todayAnalytics?.peak_hour ? `${todayAnalytics.peak_hour}:00` : null;

  return {
    dailyAnalytics,
    tableMetrics,
    isLoading,
    totalRevenue,
    totalOrders,
    averageOrderValue,
    peakHours,
  };
};