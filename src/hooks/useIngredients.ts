import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Ingredient } from '@/types/ingredients';
import { toast } from 'sonner';
import { useInstantData } from './useInstantData';

export const useIngredients = () => {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const { getInstantIngredients, isDeviceLive } = useInstantData();

  // Try to get instant data first
  const instantData = getInstantIngredients();

  // Fetch all active ingredients
  const { data: ingredients = [], isLoading, error } = useQuery({
    queryKey: ['ingredients', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      // For bound devices, check cache first then use edge function
      const { isDeviceBound } = await import('@/utils/deviceBinding');
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData(['ingredients', companyId]);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return cached as Ingredient[];
        }

        const { data, error } = await supabase.functions.invoke('pin-ingredients-fetch', {
          body: { companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          return cached || [];
        }

        return (data.ingredients || []) as Ingredient[];
      }

      // Web users: direct query
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Ingredient[];
    },
    enabled: !!companyId && companyId !== 'undefined',
    initialData: instantData.data,
    retry: 0,
  });

  // Create ingredient mutation
  const createIngredient = useMutation({
    mutationFn: async (ingredient: Omit<Ingredient, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => {
      const { offlineAwareInsert } = await import('@/utils/offlineAwareSupabase');
      const result = await offlineAwareInsert('ingredients', { ...ingredient, company_id: companyId });
      
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (newIngredient) => {
      // Optimistically update cache immediately
      const cacheKey = ['ingredients', companyId];
      queryClient.setQueryData(cacheKey, (oldData: Ingredient[] = []) => {
        // Check if already exists (in case real-time beat us)
        const exists = oldData.some(item => item.id === newIngredient.id);
        if (exists) return oldData;
        
        // Add new ingredient and sort by name
        return [...oldData, newIngredient].sort((a, b) => 
          a.name.localeCompare(b.name)
        );
      });
      
      toast.success('Ingredient added successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add ingredient');
    },
  });

  // Update ingredient mutation
  const updateIngredient = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Ingredient> & { id: string }) => {
      const { offlineAwareUpdate } = await import('@/utils/offlineAwareSupabase');
      const result = await offlineAwareUpdate('ingredients', id, updates);
      
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (updatedIngredient) => {
      // Optimistically update cache immediately
      const cacheKey = ['ingredients', companyId];
      queryClient.setQueryData(cacheKey, (oldData: Ingredient[] = []) => {
        return oldData
          .map(item => item.id === updatedIngredient.id ? updatedIngredient : item)
          .sort((a, b) => a.name.localeCompare(b.name));
      });
      
      toast.success('Ingredient updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update ingredient');
    },
  });

  // Soft delete ingredient
  const deleteIngredient = useMutation({
    mutationFn: async (id: string) => {
      const { offlineAwareUpdate } = await import('@/utils/offlineAwareSupabase');
      const result = await offlineAwareUpdate('ingredients', id, { is_active: false });
      
      if (result.error) throw result.error;
      return id; // Return the ID so we can use it in onSuccess
    },
    onSuccess: (deletedId) => {
      // Optimistically remove from cache immediately
      const cacheKey = ['ingredients', companyId];
      queryClient.setQueryData(cacheKey, (oldData: Ingredient[] = []) => {
        return oldData.filter(item => item.id !== deletedId);
      });
      
      toast.success('Ingredient deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete ingredient');
    },
  });

  // Return instant data if available, otherwise use query result
  const finalIngredients = (instantData.isInstant && instantData.data 
    ? instantData.data 
    : ingredients) as Ingredient[];

  // Adjust isLoading: if we have instant data, never show loading
  const finalIsLoading = instantData.isInstant ? false : isLoading;

  // Real-time subscription for ingredient updates across all devices
  useEffect(() => {
    if (!companyId || companyId === 'undefined') return;
    
    // Skip if DeviceDataManager is handling this
    if (isDeviceLive.isActive) {
      console.log('📦 useIngredients: Skipping component-level subscription (DeviceDataManager active)');
      return;
    }

    const channel = supabase
      .channel(`ingredients-updates-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'ingredients',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('📦 Real-time ingredient update:', payload);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            const newIngredient = payload.new as Ingredient;
            // Only add if active
            if (newIngredient.is_active) {
              queryClient.setQueryData(['ingredients', companyId], (prev: Ingredient[] = []) => {
                const existingIndex = prev.findIndex(item => item.id === newIngredient.id);
                if (existingIndex === -1) {
                  return [...prev, newIngredient].sort((a, b) => 
                    a.name.localeCompare(b.name)
                  );
                }
                return prev;
              });
            }
          } 
          
          else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedIngredient = payload.new as Ingredient;
            queryClient.setQueryData(['ingredients', companyId], (prev: Ingredient[] = []) => {
              // If marked inactive, remove from list
              if (!updatedIngredient.is_active) {
                return prev.filter(item => item.id !== updatedIngredient.id);
              }
              // Otherwise update the item
              return prev.map(item => 
                item.id === updatedIngredient.id ? updatedIngredient : item
              ).sort((a, b) => a.name.localeCompare(b.name));
            });
          } 
          
          else if (payload.eventType === 'DELETE' && payload.old) {
            queryClient.setQueryData(['ingredients', companyId], (prev: Ingredient[] = []) => 
              prev.filter(item => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient, isDeviceLive]);

  return {
    ingredients: finalIngredients,
    isLoading: finalIsLoading,
    error,
    createIngredient,
    updateIngredient,
    deleteIngredient,
  };
};
