import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateMenuItemAllergens } from '@/utils/allergens';
import { MenuItemIngredient } from '@/types/ingredients';
import { useQueryClient } from '@tanstack/react-query';

export const useMenuItemAllergens = (menuItemId?: string) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['menu-item-allergens', menuItemId],
    queryFn: async () => {
      if (!menuItemId) return [];
      
      // For bound devices, check cache first
      const { isDeviceBound } = await import('@/utils/deviceBinding');
      if (isDeviceBound()) {
        const cached = queryClient.getQueryData(['menu-item-ingredients', menuItemId]);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return calculateMenuItemAllergens(cached as MenuItemIngredient[]);
        }
      }
      
      const { data, error } = await supabase
        .from('menu_item_ingredients')
        .select('*')
        .eq('menu_item_id', menuItemId)
        .order('display_order');
      
      if (error) {
        // For bound devices, use cache as fallback
        const { isDeviceBound } = await import('@/utils/deviceBinding');
        if (isDeviceBound()) {
          const cached = queryClient.getQueryData(['menu-item-ingredients', menuItemId]);
          if (cached) return calculateMenuItemAllergens(cached as MenuItemIngredient[]);
        }
        throw error;
      }
      
      return calculateMenuItemAllergens(data as MenuItemIngredient[]);
    },
    enabled: !!menuItemId,
    retry: 0,
  });
};
