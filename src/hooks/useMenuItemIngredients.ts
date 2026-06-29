import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MenuItemIngredient } from '@/types/ingredients';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';

export const useMenuItemIngredients = (menuItemId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId } = useAuth();

  const { data: ingredients = [], isLoading, error } = useQuery({
    queryKey: ['menu-item-ingredients', menuItemId],
    queryFn: async () => {
      if (!menuItemId) return [];
      
      // For bound devices, check cache first
      const { isDeviceBound } = await import('@/utils/deviceBinding');
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData(['menu-item-ingredients', menuItemId]);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          console.log('📦 useMenuItemIngredients: Using cached ingredients:', cached.length);
          return cached as MenuItemIngredient[];
        }
        console.log('📦 useMenuItemIngredients: Cache empty, falling back to direct query');
      }
      
      const { data, error } = await supabase
        .from('menu_item_ingredients')
        .select('*')
        .eq('menu_item_id', menuItemId)
        .eq('company_id', companyId)
        .order('display_order', { ascending: true });

      if (error) {
        // For bound devices, use cache as fallback
        const { isDeviceBound } = await import('@/utils/deviceBinding');
        if (isDeviceBound()) {
          const cached = queryClient.getQueryData(['menu-item-ingredients', menuItemId]);
          if (cached) return cached as MenuItemIngredient[];
        }
        throw error;
      }
      return data as MenuItemIngredient[];
    },
    enabled: !!menuItemId,
    retry: 0,
  });

  const createIngredient = useMutation({
    mutationFn: async (ingredient: Omit<MenuItemIngredient, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('menu_item_ingredients')
        .insert(ingredient)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-item-ingredients', menuItemId] });
      queryClient.invalidateQueries({ queryKey: ['menu-item-allergens', menuItemId] });
      queryClient.invalidateQueries({ queryKey: ['menu_items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-management'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-builder'] });
      toast({
        title: 'Success',
        description: 'Ingredient added successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add ingredient',
        variant: 'destructive',
      });
    },
  });

  const updateIngredient = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MenuItemIngredient> & { id: string }) => {
      const { data, error } = await supabase
        .from('menu_item_ingredients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-item-ingredients', menuItemId] });
      queryClient.invalidateQueries({ queryKey: ['menu-item-allergens', menuItemId] });
      queryClient.invalidateQueries({ queryKey: ['menu_items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-management'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-builder'] });
      toast({
        title: 'Success',
        description: 'Ingredient updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update ingredient',
        variant: 'destructive',
      });
    },
  });

  const deleteIngredient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_item_ingredients')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-item-ingredients', menuItemId] });
      queryClient.invalidateQueries({ queryKey: ['menu-item-allergens', menuItemId] });
      queryClient.invalidateQueries({ queryKey: ['menu_items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-management'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items-builder'] });
      toast({
        title: 'Success',
        description: 'Ingredient deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete ingredient',
        variant: 'destructive',
      });
    },
  });

  // Real-time subscription for ingredient updates
  useEffect(() => {
    if (!menuItemId || !companyId) return;

    const channel = supabase
      .channel(`menu-item-ingredients-${menuItemId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_item_ingredients',
          filter: `menu_item_id=eq.${menuItemId}`
        },
        (payload) => {
          console.log('🥬 Real-time menu item ingredients update:', payload);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            queryClient.setQueryData(['menu-item-ingredients', menuItemId], (prev: MenuItemIngredient[] = []) => {
              const exists = prev.some(item => item.id === payload.new.id);
              if (!exists) {
                return [...prev, payload.new as MenuItemIngredient].sort((a, b) => a.display_order - b.display_order);
              }
              return prev;
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            queryClient.setQueryData(['menu-item-ingredients', menuItemId], (prev: MenuItemIngredient[] = []) =>
              prev.map(item => item.id === payload.new.id ? payload.new as MenuItemIngredient : item)
                .sort((a, b) => a.display_order - b.display_order)
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            queryClient.setQueryData(['menu-item-ingredients', menuItemId], (prev: MenuItemIngredient[] = []) =>
              prev.filter(item => item.id !== payload.old.id)
            );
          }
          
          // Invalidate menu-item-allergens to trigger recalculation
          queryClient.invalidateQueries({ queryKey: ['menu-item-allergens', menuItemId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [menuItemId, companyId, queryClient]);

  return {
    ingredients,
    isLoading,
    error,
    createIngredient: createIngredient.mutate,
    updateIngredient: updateIngredient.mutate,
    deleteIngredient: deleteIngredient.mutate,
  };
};
