import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
  category_id?: string;
  tags?: string[];
  allergens?: string[];
  company_id: string;
  display_order?: number;
  card_color?: string;
  created_at: string;
  category_type?: 'drinks' | 'starters' | 'mains' | 'desserts';
}

export function useMenuItems() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId, loading: authLoading } = useAuth();

  const menuItemsQuery = useQuery({
    queryKey: ['menu_items', companyId],
    queryFn: async (): Promise<MenuItem[]> => {
      if (!companyId) return [];

      // For bound devices, check cache first then use edge function
      const { isDeviceBound } = await import('@/utils/deviceBinding');
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData<MenuItem[]>(['menu_items', companyId]);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return cached;
        }

        const { data, error } = await supabase.functions.invoke('pin-menu-items-fetch', {
          body: { companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          return cached || [];
        }

        return (data.items || []) as MenuItem[];
      }

      // Web users: direct query with join
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          menu_categories!inner (
            category_type
          )
        `)
        .eq('company_id', companyId)
        .order('display_order', { ascending: true });

      if (error) throw error;

      // Transform data to flatten category_type onto menu item
      const transformedData = data?.map(({ menu_categories, ...item }: any) => ({
        ...item,
        category_type: menu_categories?.category_type || 'mains'
      })) || [];
      
      return transformedData;
    },
    enabled: !authLoading && !!companyId,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    retry: 0,
  });

  const createMenuItemMutation = useMutation({
    mutationFn: async (menuItemData: Omit<MenuItem, 'id' | 'created_at' | 'company_id'>): Promise<MenuItem> => {
      if (!companyId) throw new Error('No company found');

      const { data, error } = await supabase
        .from('menu_items')
        .insert([{ ...menuItemData, company_id: companyId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['menu_items', companyId] });
      const previousItems = queryClient.getQueryData(['menu_items', companyId]);
      
      const optimisticItem: MenuItem = {
        ...newItem,
        id: `temp_${Date.now()}`,
        company_id: companyId!,
        created_at: new Date().toISOString(),
      };
      
      queryClient.setQueryData(['menu_items', companyId], (old: MenuItem[] = []) =>
        [...old, optimisticItem].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      );

      return { previousItems };
    },
    onSuccess: (newItem, variables, context) => {
      queryClient.setQueryData(['menu_items', companyId], (old: MenuItem[] = []) =>
        old.map(item => 
          item.id.startsWith('temp_') && item.name === newItem.name ? newItem : item
        )
      );
      toast({ title: "Success", description: "Menu item created successfully" });
    },
    onError: (error, variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['menu_items', companyId], context.previousItems);
      }
      toast({ title: "Error", description: "Failed to create menu item", variant: "destructive" });
    }
  });

  const updateMenuItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MenuItem> }): Promise<MenuItem> => {
      const { data, error } = await supabase
        .from('menu_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['menu_items', companyId] });
      const previousItems = queryClient.getQueryData(['menu_items', companyId]);
      
      queryClient.setQueryData(['menu_items', companyId], (old: MenuItem[] = []) =>
        old.map(item => item.id === id ? { ...item, ...updates } : item)
          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      );

      return { previousItems };
    },
    onSuccess: (updatedItem) => {
      queryClient.setQueryData(['menu_items', companyId], (old: MenuItem[] = []) =>
        old.map(item => item.id === updatedItem.id ? updatedItem : item)
      );
      toast({ title: "Success", description: "Menu item updated successfully" });
    },
    onError: (error, variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['menu_items', companyId], context.previousItems);
      }
      toast({ title: "Error", description: "Failed to update menu item", variant: "destructive" });
    }
  });

  const deleteMenuItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['menu_items', companyId] });
      const previousItems = queryClient.getQueryData(['menu_items', companyId]);
      
      queryClient.setQueryData(['menu_items', companyId], (old: MenuItem[] = []) =>
        old.filter(item => item.id !== id)
      );

      return { previousItems };
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Menu item deleted successfully" });
    },
    onError: (error, variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['menu_items', companyId], context.previousItems);
      }
      toast({ title: "Error", description: "Failed to delete menu item", variant: "destructive" });
    }
  });

  const reorderMenuItemsMutation = useMutation({
    mutationFn: async (updates: { id: string; display_order: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from('menu_items')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
        
        if (error) throw error;
      }
    },
    onMutate: async (updates: { id: string; display_order: number }[]) => {
      await queryClient.cancelQueries({ queryKey: ['menu_items', companyId] });
      const previous = queryClient.getQueryData<MenuItem[]>(['menu_items', companyId]);

      if (previous) {
        const updated = [...previous]
          .map((item) => {
            const itemUpdate = updates.find(u => u.id === item.id);
            return itemUpdate ? { ...item, display_order: itemUpdate.display_order } : item;
          })
          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

        queryClient.setQueryData(['menu_items', companyId], updated);
      }

      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] });
    },
    onError: (error, _updates, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['menu_items', companyId], context.previous);
      }
      toast({ title: "Error", description: "Failed to reorder menu items", variant: "destructive" });
    }
  });

  // Real-time subscription for menu items updates
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`menu-items-updates-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('🍽️ Real-time menu items update:', payload);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            const newItem = payload.new as MenuItem;
            queryClient.setQueryData(['menu_items', companyId], (prev: MenuItem[] = []) => {
              const existingIndex = prev.findIndex(item => item.id === newItem.id);
              if (existingIndex === -1) {
                return [...prev, newItem].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
              }
              return prev;
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedItem = payload.new as MenuItem;
            queryClient.setQueryData(['menu_items', companyId], (prev: MenuItem[] = []) => 
              prev.map(item => item.id === updatedItem.id ? updatedItem : item)
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            queryClient.setQueryData(['menu_items', companyId], (prev: MenuItem[] = []) => 
              prev.filter(item => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  return {
    menuItems: menuItemsQuery.data || [],
    loading: menuItemsQuery.isLoading,
    error: menuItemsQuery.error?.message,
    createMenuItem: createMenuItemMutation.mutateAsync,
    updateMenuItem: (id: string, updates: Partial<MenuItem>) => 
      updateMenuItemMutation.mutateAsync({ id, updates }),
    deleteMenuItem: deleteMenuItemMutation.mutateAsync,
    reorderMenuItems: reorderMenuItemsMutation.mutateAsync,
    refetch: menuItemsQuery.refetch,
    isCreating: createMenuItemMutation.isPending,
    isUpdating: updateMenuItemMutation.isPending,
    isDeleting: deleteMenuItemMutation.isPending,
  };
}