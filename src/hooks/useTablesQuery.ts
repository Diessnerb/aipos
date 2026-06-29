import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { getBoundCompany, isDeviceBound } from '@/utils/deviceBinding';
import { Table } from '@/types/table';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';

// Helper function to sort tables by table_number
const sortTablesByNumber = (tables: Table[]): Table[] => {
  return [...tables].sort((a, b) => a.table_number - b.table_number);
};

export interface TableChangeEvent {
  type: 'table_unavailable' | 'table_change';
  tableId?: string;
  tableNumber?: number;
  serviceStatus?: 'out_of_service' | 'temporarily_removed';
  scheduledEnd?: string | null;
  scheduledAt?: string | null;
  durationDays?: number | null;
}

interface UseTablesQueryOptions {
  onTableChange?: (event?: TableChangeEvent) => void;
}

export const useTablesQuery = (options?: UseTablesQueryOptions) => {
  const queryClient = useQueryClient();
  const { companyId: authCompanyId, loading: authLoading } = useAuth();
  const deviceLive = useDeviceLiveLayer();
  
  // Resolve companyId: prefer auth, fallback to bound company
  const boundCompany = getBoundCompany();
  const companyId = authCompanyId || boundCompany?.company_id;
  
  if (!authCompanyId && boundCompany?.company_id) {
    console.warn('⚠️ useTablesQuery: Using bound company fallback for companyId');
  }
  
  // Instant data access when device is bound
  const getInstantTables = () => {
    if (deviceLive && companyId) {
      const cached = queryClient.getQueryData(['tables', companyId]) as any;
      // Expect plain array only (standard shape)
      return Array.isArray(cached) ? cached : undefined;
    }
    return undefined;
  };

  const instantTables = getInstantTables();
  
  const query = useQuery({
    queryKey: ['tables', companyId],
    queryFn: async (): Promise<Table[]> => {
      if (!companyId) {
        console.log('🏪 No companyId available for tables query');
        return [];
      }

      // If device is live, prioritize cached data
      if (deviceLive && instantTables) {
        console.log('💨 Using device cache for tables');
        return instantTables as Table[];
      }

      console.log('🏪 Fetching tables via React Query for company:', companyId);

      // Prefer edge function when device is bound (PIN flow) to bypass RLS issues
      try {
        if (isDeviceBound()) {
          const { data: resp, error: fnError } = await supabase.functions.invoke('pin-tables-fetch', {
            body: { companyId, isDeviceBound: true },
          });

          if (fnError) {
            console.warn('🏪 Edge function fetch failed, falling back to direct query', fnError);
          } else if (resp?.success) {
            const tables = (resp.tables || []) as any[];
            return sortTablesByNumber(
              tables.map((table: any): Table => ({
                ...table,
                service_status: (table.service_status as 'available' | 'out_of_service' | 'temporarily_removed') || 'available',
                status: table.status || 'active',
                floor_plan_x: table.floor_plan_x ?? table.x_position ?? null,
                floor_plan_y: table.floor_plan_y ?? table.y_position ?? null,
                floor_plan_rotation: table.floor_plan_rotation ?? table.rotation ?? null,
              }))
            );
          }
        }
      } catch (e) {
        console.warn('🏪 Edge function invocation threw, falling back to direct query', e);
      }

      // Fallback: direct query (works when authenticated via owner login)
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('company_id', companyId)
        .order('table_number', { ascending: true });

      if (error) {
        console.error('🏪 Tables query error:', error);
        throw error;
      }

      return (data || []).map((table: any): Table => ({
        ...table, // Spread all fields from database
        // Only override/normalize specific fields that need transformation
        service_status: (table.service_status as 'available' | 'out_of_service' | 'temporarily_removed') || 'available',
        status: table.status || 'active',
        // Map position fields for compatibility
        floor_plan_x: table.floor_plan_x ?? table.x_position ?? null,
        floor_plan_y: table.floor_plan_y ?? table.y_position ?? null,
        floor_plan_rotation: table.floor_plan_rotation ?? table.rotation ?? null,
      }));
    },
    enabled: !authLoading && !!companyId, // Always enabled if auth ready (fallback support)
    staleTime: deviceLive ? Infinity : 5 * 60 * 1000, // Don't refetch if deviceLive has it
    refetchOnWindowFocus: !deviceLive,
    refetchOnMount: !deviceLive, // But allow mount-time fetch if cache empty
    placeholderData: (prev) => prev,
    initialData: instantTables as Table[],
  });

  // Set up real-time subscription for tables (only if device live layer is not active)
  useEffect(() => {
    if (!companyId || authLoading || deviceLive) return;

    console.log('🏪 Setting up real-time tables subscription');

    const channel = supabase
      .channel('tables-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('🏪 Real-time table update:', payload);
          
          // Smart cache update instead of full invalidation
          const currentData = queryClient.getQueryData<Table[]>(['tables', companyId]) || [];
          
          if (payload.eventType === 'INSERT' && payload.new) {
            const newTable = payload.new as Table;
            // Insert in correct position and sort to maintain order
            const updatedData = sortTablesByNumber([...currentData, newTable]);
            queryClient.setQueryData(['tables', companyId], updatedData);
            
            // Trigger optimization since table configuration changed
            options?.onTableChange?.();
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedTable = payload.new as Table;
            const oldTable = currentData.find(t => t.id === updatedTable.id);
            
            const updatedData = currentData.map(t => {
              if (t.id === updatedTable.id) {
                // Preserve existing fields, only override with new values that are not null/undefined
                return {
                  ...t,  // Keep all existing fields first
                  ...Object.fromEntries(
                    Object.entries(updatedTable).filter(([_, v]) => v !== null && v !== undefined)
                  )
                };
              }
              return t;
            });
            // Re-sort in case table_number changed
            queryClient.setQueryData(['tables', companyId], sortTablesByNumber(updatedData));
            
            // Check if service_status changed to unavailable
            const wasAvailable = !oldTable?.service_status || oldTable?.service_status === 'available';
            const isNowUnavailable = updatedTable.service_status === 'out_of_service' || 
                                     updatedTable.service_status === 'temporarily_removed';
            
            if (wasAvailable && isNowUnavailable) {
              console.log(`⚠️ Table ${updatedTable.table_number} became unavailable - fetching schedule details`);
              
              // Fetch the service schedule to get scheduled_end (async operation)
              (async () => {
                try {
                  const { data: schedules } = await supabase
                    .from('table_service_schedules')
                    .select('scheduled_end, scheduled_at, duration_days')
                    .eq('table_id', updatedTable.id)
                    .is('resolved_at', null)
                    .order('created_at', { ascending: false })
                    .limit(1);
                  
                  const schedule = schedules?.[0];
                  
                  console.log(`📅 Schedule found:`, schedule);
                  
                  // Pass the unavailable table info with schedule data to the callback
                  options?.onTableChange?.({
                    type: 'table_unavailable',
                    tableId: updatedTable.id,
                    tableNumber: updatedTable.table_number,
                    serviceStatus: updatedTable.service_status as 'out_of_service' | 'temporarily_removed',
                    scheduledEnd: schedule?.scheduled_end || null,
                    scheduledAt: schedule?.scheduled_at || null,
                    durationDays: schedule?.duration_days || null
                  });
                } catch (err) {
                  console.error('Error fetching schedule:', err);
                  
                  // Fallback: trigger without schedule data
                  options?.onTableChange?.({
                    type: 'table_unavailable',
                    tableId: updatedTable.id,
                    tableNumber: updatedTable.table_number,
                    serviceStatus: updatedTable.service_status as 'out_of_service' | 'temporarily_removed',
                    scheduledEnd: null
                  });
                }
              })();
            } else {
              // Standard table change (configuration, seats, etc.)
              options?.onTableChange?.();
            }
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const filteredData = currentData.filter(t => t.id !== payload.old.id);
            queryClient.setQueryData(['tables', companyId], filteredData);
            
            // Trigger optimization since table configuration changed
            options?.onTableChange?.();
          } else {
            // Fallback to invalidation for complex changes
            queryClient.invalidateQueries({ queryKey: ['tables', companyId] });
            
            // Trigger optimization since table configuration changed
            options?.onTableChange?.();
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🏪 Cleaning up tables subscription');
      supabase.removeChannel(channel);
    };
  }, [companyId, authLoading, queryClient, deviceLive, options?.onTableChange]);

  return {
    tables: query.data || queryClient.getQueryData<Table[]>(['tables', companyId]) || [],
    loading: deviceLive ? false : query.isLoading, // Never show loading when device is live
    error: query.error?.message || null,
    refetch: query.refetch,
  };
};