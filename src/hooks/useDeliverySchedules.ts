import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { DeliverySchedule } from '@/types/delivery-db';

export const useDeliverySchedules = (supplierId?: string) => {
  const { pinUser } = useAuth();
  const companyId = pinUser?.company_id;
  const queryClient = useQueryClient();

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['delivery-schedules', supplierId, companyId],
    queryFn: async () => {
      if (!supplierId) return [];
      
      // For bound devices, check cache first then use edge function
      const { isDeviceBound } = await import('@/utils/deviceBinding');
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData(['delivery-schedules', supplierId, companyId]);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return cached as DeliverySchedule[];
        }

        const { data, error } = await supabase.functions.invoke('pin-delivery-schedules-fetch', {
          body: { companyId, supplierId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          return cached || [];
        }

        return (data.schedules || []) as DeliverySchedule[];
      }

      // Web users: direct query
      const { data, error } = await supabase
        .from('delivery_schedules' as any)
        .select('*')
        .eq('supplier_id', supplierId)
        .eq('company_id', companyId)
        .order('order_day_of_week');

      if (error) throw error;
      return (data || []) as unknown as DeliverySchedule[];
    },
    enabled: !!companyId && !!supplierId,
    retry: 0,
  });

  const createSchedule = useMutation({
    mutationFn: async (schedule: Omit<DeliverySchedule, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('delivery_schedules' as any)
        .insert({
          ...schedule,
          company_id: companyId,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as DeliverySchedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-schedules'] });
      toast.success('Schedule added');
    },
    onError: () => {
      toast.error('Failed to add schedule');
    },
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DeliverySchedule> & { id: string }) => {
      const { data, error } = await supabase
        .from('delivery_schedules' as any)
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as DeliverySchedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-schedules'] });
      toast.success('Schedule updated');
    },
    onError: () => {
      toast.error('Failed to update schedule');
    },
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('delivery_schedules' as any)
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-schedules'] });
      toast.success('Schedule deleted');
    },
    onError: () => {
      toast.error('Failed to delete schedule');
    },
  });

  return {
    schedules,
    isLoading,
    createSchedule: createSchedule.mutateAsync,
    updateSchedule: updateSchedule.mutateAsync,
    deleteSchedule: deleteSchedule.mutateAsync,
  };
};
