import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { offlineAwareInsert, offlineAwareUpdate, offlineAwareDelete } from '@/utils/offlineAwareSupabase';
import { useInstantData } from './useInstantData';
import type { Supplier } from '@/types/delivery-db';

export const useSuppliers = () => {
  const { pinUser } = useAuth();
  const companyId = pinUser?.company_id;
  const queryClient = useQueryClient();
  const { getInstantSuppliers, isDeviceLive } = useInstantData();

  // Try instant data first
  const instantResult = getInstantSuppliers();
  const hasInstantData = instantResult.isInstant && instantResult.data;

  const { data: fetchedSuppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // For bound devices, check cache first then use edge function
      const { isDeviceBound } = await import('@/utils/deviceBinding');
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData(['suppliers', companyId]);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return cached as Supplier[];
        }

        const { data, error } = await supabase.functions.invoke('pin-suppliers-fetch', {
          body: { companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          return cached || [];
        }

        return (data.suppliers || []) as Supplier[];
      }

      // Web users: direct query
      const { data, error } = await supabase
        .from('suppliers' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (error) throw error;
      return data as any;
    },
    enabled: !!companyId && !hasInstantData,
    initialData: () => queryClient.getQueryData(['suppliers', companyId]),
    retry: 0,
  });

  const suppliers = hasInstantData ? (instantResult.data as Supplier[]) : fetchedSuppliers;

  const createSupplier = useMutation({
    mutationFn: async (supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => {
      const data = await offlineAwareInsert('suppliers', supplier);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', companyId] });
      toast.success('Supplier created successfully');
    },
    onError: (error) => {
      console.error('Error creating supplier:', error);
      toast.error('Failed to create supplier');
    },
  });

  const updateSupplier = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Supplier> }) => {
      const data = await offlineAwareUpdate('suppliers', id, updates);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', companyId] });
      toast.success('Supplier updated successfully');
    },
    onError: (error) => {
      console.error('Error updating supplier:', error);
      toast.error('Failed to update supplier');
    },
  });

  const deleteSupplier = useMutation({
    mutationFn: async (id: string) => {
      await offlineAwareDelete('suppliers', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', companyId] });
      toast.success('Supplier deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting supplier:', error);
      toast.error('Failed to delete supplier');
    },
  });

  return {
    suppliers,
    isLoading: hasInstantData ? false : isLoading,
    createSupplier: createSupplier.mutate,
    updateSupplier: updateSupplier.mutate,
    deleteSupplier: deleteSupplier.mutate,
  };
};
