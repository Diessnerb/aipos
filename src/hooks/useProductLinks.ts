import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProductLink } from '@/types/productLinks';
import { useToast } from '@/hooks/use-toast';

export const useProductLinks = (menuItemId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: productLinks = [], isLoading } = useQuery({
    queryKey: ['product-links', menuItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_links')
        .select('*')
        .eq('menu_item_id', menuItemId)
        .eq('is_active', true)
        .order('level')
        .order('display_order');

      if (error) throw error;
      return data as ProductLink[];
    },
    enabled: !!menuItemId,
  });

  const createLink = useMutation({
    mutationFn: async (link: Omit<ProductLink, 'id' | 'created_at' | 'updated_at' | 'company_id'> & { company_id?: string }) => {
      const { data, error } = await supabase
        .from('product_links')
        .insert([link as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-links', menuItemId] });
      queryClient.invalidateQueries({ queryKey: ['menu-item-product-links'] });
      queryClient.invalidateQueries({ queryKey: ['menu_items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-management'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-builder'] });
      toast({ title: 'Link created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error creating link', description: error.message, variant: 'destructive' });
    },
  });

  const createLinkSilent = useMutation({
    mutationFn: async (link: Omit<ProductLink, 'id' | 'created_at' | 'updated_at' | 'company_id'> & { company_id?: string }) => {
      const { data, error } = await supabase
        .from('product_links')
        .insert([link as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-links', menuItemId] });
      queryClient.invalidateQueries({ queryKey: ['menu-item-product-links'] });
      queryClient.invalidateQueries({ queryKey: ['menu_items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-management'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-builder'] });
    },
    onError: (error) => {
      console.error('Error creating link:', error);
    },
  });

  const updateLink = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductLink> & { id: string }) => {
      const { data, error } = await supabase
        .from('product_links')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-links', menuItemId] });
      queryClient.invalidateQueries({ queryKey: ['menu-item-product-links'] });
      queryClient.invalidateQueries({ queryKey: ['menu_items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-management'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-builder'] });
      toast({ title: 'Link updated successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error updating link', description: error.message, variant: 'destructive' });
    },
  });

  const updateLinkSilent = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductLink> & { id: string }) => {
      const { data, error } = await supabase
        .from('product_links')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-links', menuItemId] });
      queryClient.invalidateQueries({ queryKey: ['menu-item-product-links'] });
      queryClient.invalidateQueries({ queryKey: ['menu_items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-management'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-builder'] });
    },
    onError: (error) => {
      console.error('Error updating link:', error);
    },
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-links', menuItemId] });
      queryClient.invalidateQueries({ queryKey: ['menu-item-product-links'] });
      queryClient.invalidateQueries({ queryKey: ['menu_items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-management'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-builder'] });
      toast({ title: 'Link deleted successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error deleting link', description: error.message, variant: 'destructive' });
    },
  });

  return {
    productLinks,
    isLoading,
    createLink: createLink.mutateAsync,
    createLinkSilent: createLinkSilent.mutateAsync,
    updateLink: updateLink.mutateAsync,
    updateLinkSilent: updateLinkSilent.mutateAsync,
    deleteLink: deleteLink.mutateAsync,
  };
};
