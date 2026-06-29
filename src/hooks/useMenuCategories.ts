import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { MenuCategory } from '@/types/menu';

export type { MenuCategory };

export const useMenuCategories = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const { isActive: deviceLive } = useDeviceLiveLayer();

  // Helper function to fetch and structure categories properly
  const fetchAndStructureCategories = async (): Promise<MenuCategory[]> => {
    if (!companyId) return [];

    console.log('🔄 Hydrating cache with hierarchical categories for companyId:', companyId);

    let data: any[] = [];
    let error: any = null;

    // For bound devices, use the edge function
    if (deviceLive) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('pin-menu-categories-fetch', {
        body: { companyId, isDeviceBound: true }
      });
      
      if (edgeError) {
        console.error('❌ Error fetching categories from edge function:', edgeError);
        error = edgeError;
      } else if (edgeData?.success) {
        data = edgeData.categories || [];
      } else {
        console.error('❌ Edge function returned error:', edgeData?.error);
        error = new Error(edgeData?.error || 'Unknown error');
      }
    } else {
      // For web users, use direct query (RLS applies)
      const result = await supabase
        .from('menu_categories')
        .select('*')
        .eq('is_active', true)
        .eq('company_id', companyId)
        .order('display_order');
      
      data = result.data || [];
      error = result.error;
    }

    if (error) {
      console.error('❌ Error fetching categories for cache hydration:', error);
      return [];
    }

    // Organize into hierarchical structure
    const mainCategories: MenuCategory[] = [];
    const subcategoriesMap: { [parentId: string]: MenuCategory[] } = {};

    data.forEach((category) => {
      if (category.parent_id === null) {
        mainCategories.push({
          ...category,
          category_type: category.category_type as 'drinks' | 'starters' | 'mains' | 'desserts' | undefined,
          subcategories: [],
        });
      } else {
        if (!subcategoriesMap[category.parent_id]) {
          subcategoriesMap[category.parent_id] = [];
        }
        subcategoriesMap[category.parent_id].push({
          ...category,
          category_type: category.category_type as 'drinks' | 'starters' | 'mains' | 'desserts' | undefined,
        });
      }
    });

    // Attach subcategories to main categories
    mainCategories.forEach((category) => {
      category.subcategories = subcategoriesMap[category.id] || [];
      category.subcategories.sort((a, b) => a.display_order - b.display_order);
    });

    console.log('✅ Cache hydrated with', mainCategories.length, 'main categories');
    return mainCategories;
  };

  // Initialize cache with proper hierarchical data when deviceLive is active
  useEffect(() => {
    const initializeCache = async () => {
      if (!deviceLive || !companyId) return;

      const cachedData = queryClient.getQueryData<MenuCategory[]>(['menu_categories', companyId]);
      
      // Check if cache is empty or has flat structure (missing hierarchy)
      const needsHydration = !cachedData || 
        cachedData.length === 0 || 
        cachedData.some(cat => cat.subcategories === undefined);

      if (needsHydration) {
        console.log('🚀 Initializing cache with hierarchical data (deviceLive mode)');
        const structuredData = await fetchAndStructureCategories();
        if (structuredData.length > 0) {
          queryClient.setQueryData(['menu_categories', companyId], structuredData);
        }
      } else {
        console.log('✓ Cache already properly hydrated with', cachedData.length, 'categories');
      }
    };

    initializeCache();
  }, [deviceLive, companyId, queryClient]);

  // Get instant data from cache when device is live
  const instantCategories = deviceLive && companyId ? 
    queryClient.getQueryData<MenuCategory[]>(['menu_categories', companyId]) || [] : [];

  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: ['menu_categories', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('🏷️ No companyId available for menu categories');
        return [];
      }

      console.log('🏷️ Fetching menu categories for companyId:', companyId);

      let data: any[] = [];
      let error: any = null;

      // For bound devices, use the edge function
      if (deviceLive) {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('pin-menu-categories-fetch', {
          body: { companyId, isDeviceBound: true }
        });
        
        if (edgeError) {
          console.error('❌ Error fetching categories from edge function:', edgeError);
          error = edgeError;
        } else if (edgeData?.success) {
          data = edgeData.categories || [];
        } else {
          console.error('❌ Edge function returned error:', edgeData?.error);
          error = new Error(edgeData?.error || 'Unknown error');
        }
      } else {
        // For web users, use direct query (RLS applies)
        const result = await supabase
          .from('menu_categories')
          .select('*')
          .eq('is_active', true)
          .eq('company_id', companyId)
          .order('display_order');
        
        data = result.data || [];
        error = result.error;
      }

      console.log('🏷️ Menu categories query result:', { 
        dataLength: data?.length, 
        firstCategory: data?.[0], 
        error: error 
      });

      if (error) throw error;

      // Organize into hierarchical structure
      const mainCategories: MenuCategory[] = [];
      const subcategoriesMap: { [parentId: string]: MenuCategory[] } = {};

      data.forEach((category) => {
        if (category.parent_id === null) {
          mainCategories.push({ 
            ...category, 
            category_type: category.category_type as 'drinks' | 'starters' | 'mains' | 'desserts' | undefined,
            subcategories: [] 
          });
        } else {
          if (!subcategoriesMap[category.parent_id]) {
            subcategoriesMap[category.parent_id] = [];
          }
          subcategoriesMap[category.parent_id].push({
            ...category,
            category_type: category.category_type as 'drinks' | 'starters' | 'mains' | 'desserts' | undefined,
          });
        }
      });

      // Attach subcategories to main categories
      mainCategories.forEach((category) => {
        category.subcategories = subcategoriesMap[category.id] || [];
        category.subcategories.sort((a, b) => a.display_order - b.display_order);
      });

      return mainCategories;
    },
    enabled: !deviceLive && !!companyId, // Skip if device is live
    initialData: instantCategories.length > 0 ? instantCategories : undefined,
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (newCategory: {
      name: string;
      description?: string;
      parent_id?: string | null;
      category_type?: 'drinks' | 'starters' | 'mains' | 'desserts';
    }) => {
      // Guard against missing companyId
      if (!companyId) {
        throw new Error('Company ID is required to create categories');
      }

      // Get the next display order
      let display_order = 1;
      if (newCategory.parent_id) {
        // Subcategory - get max order within parent (scoped by company)
        const { data: siblings } = await supabase
          .from('menu_categories')
          .select('display_order')
          .eq('parent_id', newCategory.parent_id)
          .eq('company_id', companyId)
          .order('display_order', { ascending: false })
          .limit(1);
        
        if (siblings && siblings.length > 0) {
          display_order = siblings[0].display_order + 1;
        }
      } else {
        // Main category - get max order among main categories (scoped by company)
        const { data: siblings } = await supabase
          .from('menu_categories')
          .select('display_order')
          .is('parent_id', null)
          .eq('company_id', companyId)
          .order('display_order', { ascending: false })
          .limit(1);
        
        if (siblings && siblings.length > 0) {
          display_order = siblings[0].display_order + 1;
        }
      }

      const { data, error } = await supabase
        .from('menu_categories')
        .insert([{ 
          name: newCategory.name,
          description: newCategory.description,
          parent_id: newCategory.parent_id,
          category_type: (newCategory as any).category_type || 'mains',
          display_order, 
          company_id: companyId 
        }])
        .select()
        .single();

      if (error) throw error;
      return { data, isSubcategory: !!newCategory.parent_id };
    },
    onSuccess: async (result) => {
      // In deviceLive mode, manually refresh cache to ensure hierarchy is rebuilt
      if (deviceLive) {
        console.log('🔄 Refreshing cache after category creation (deviceLive mode)');
        const structuredData = await fetchAndStructureCategories();
        queryClient.setQueryData(['menu_categories', companyId], structuredData);
      } else {
        queryClient.invalidateQueries({ queryKey: ['menu_categories', companyId] });
      }
      
      toast({
        title: 'Success',
        description: result.isSubcategory ? 'Subcategory created successfully' : 'Category created successfully',
      });
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create category';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      console.error('Error creating category:', error);
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MenuCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('menu_categories')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      // In deviceLive mode, manually refresh cache to ensure hierarchy is rebuilt
      if (deviceLive) {
        console.log('🔄 Refreshing cache after category update (deviceLive mode)');
        const structuredData = await fetchAndStructureCategories();
        queryClient.setQueryData(['menu_categories', companyId], structuredData);
      } else {
        queryClient.invalidateQueries({ queryKey: ['menu_categories', companyId] });
      }
      
      toast({
        title: 'Success',
        description: 'Category updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update category',
        variant: 'destructive',
      });
      console.error('Error updating category:', error);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_categories')
        .update({ is_active: false })
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_categories', companyId] });
      toast({
        title: 'Success',
        description: 'Category deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to delete category',
        variant: 'destructive',
      });
      console.error('Error deleting category:', error);
    },
  });

  const reorderCategoriesMutation = useMutation({
    mutationFn: async (updates: { id: string; display_order: number }[]) => {
      // Use individual updates since we don't have an RPC function yet
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('menu_categories')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
        
        if (updateError) throw updateError;
      }
    },
    onMutate: async (updates: { id: string; display_order: number }[]) => {
      await queryClient.cancelQueries({ queryKey: ['menu_categories', companyId] });
      const previous = queryClient.getQueryData<MenuCategory[]>(['menu_categories', companyId]);

      if (previous) {
        // Apply optimistic updates to both main categories and their subcategories
        const updated = [...previous]
          .map((cat) => {
            const catUpdate = updates.find(u => u.id === cat.id);
            const newCat = catUpdate ? { ...cat, display_order: catUpdate.display_order } : cat;

            const newSubs = (newCat.subcategories || []).map((sub) => {
              const subUpdate = updates.find(u => u.id === sub.id);
              return subUpdate ? { ...sub, display_order: subUpdate.display_order } : sub;
            }).sort((a, b) => a.display_order - b.display_order);

            return newSubs !== newCat.subcategories || catUpdate
              ? { ...newCat, subcategories: newSubs }
              : newCat;
          })
          .sort((a, b) => a.display_order - b.display_order);

        queryClient.setQueryData(['menu_categories', companyId], updated);
      }

      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_categories', companyId] });
    },
    onError: (error, _updates, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['menu_categories', companyId], context.previous);
      }
      toast({
        title: 'Error',
        description: 'Failed to reorder categories',
        variant: 'destructive',
      });
      console.error('Error reordering categories:', error);
    },
  });

  return {
    categories: deviceLive && instantCategories.length > 0 ? instantCategories : categories,
    isLoading: deviceLive ? false : isLoading,
    error,
    createCategory: createCategoryMutation.mutate,
    updateCategory: updateCategoryMutation.mutate,
    deleteCategory: deleteCategoryMutation.mutate,
    reorderCategories: reorderCategoriesMutation.mutate,
    isCreating: createCategoryMutation.isPending,
    isUpdating: updateCategoryMutation.isPending,
    isDeleting: deleteCategoryMutation.isPending,
  };
};