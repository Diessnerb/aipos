import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

export interface SupplierCategory {
  id: string;
  company_id: string;
  name: string;
  color_scheme: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const useSupplierCategories = () => {
  const { pinUser } = useAuth();
  const companyId = pinUser?.company_id;
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['supplier-categories', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_categories' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      return (data || []) as unknown as SupplierCategory[];
    },
    enabled: !!companyId,
  });

  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('supplier_categories' as any)
        .insert({
          company_id: companyId,
          name: name.trim(),
          color_scheme: 'gray',
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SupplierCategory;
    },
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-categories', companyId] });
      toast.success(`Category "${newCategory.name}" created`);
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('This category already exists');
      } else {
        toast.error('Failed to create category');
      }
    },
  });

  return {
    categories,
    isLoading,
    createCategory: createCategory.mutateAsync,
  };
};
