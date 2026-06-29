import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

interface MenuItemUsage {
  id: string;
  name: string;
}

interface IngredientUsageData {
  count: number;
  items: MenuItemUsage[];
}

export const useIngredientUsage = (ingredientName: string) => {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['ingredient-usage', ingredientName, companyId],
    queryFn: async () => {
      // For bound devices, calculate from cached menu_item_ingredients
      const { isDeviceBound } = await import('@/utils/deviceBinding');
      if (isDeviceBound()) {
        const allIngredients = queryClient.getQueriesData({ queryKey: ['menu-item-ingredients'] });
        const items: MenuItemUsage[] = [];
        
        for (const [key, data] of allIngredients) {
          if (Array.isArray(data)) {
            const menuItemId = Array.isArray(key) ? key[1] : null;
            const hasIngredient = data.some((ing: any) => 
              ing.ingredient_name?.toLowerCase().includes(ingredientName.toLowerCase())
            );
            
            if (hasIngredient && menuItemId) {
              // Try to get menu item name from cache
              const menuItems = queryClient.getQueryData(['menu_items', companyId]) as any[];
              const menuItem = menuItems?.find((mi: any) => mi.id === menuItemId);
              if (menuItem) {
                items.push({ id: menuItem.id, name: menuItem.name });
              }
            }
          }
        }
        
        return { count: items.length, items } as IngredientUsageData;
      }
      
      const { data, error } = await supabase
        .from('menu_item_ingredients')
        .select(`
          menu_item_id,
          menu_items (
            id,
            name
          )
        `)
        .eq('company_id', companyId)
        .ilike('ingredient_name', ingredientName);

      if (error) throw error;

      const items = data
        ?.map(d => d.menu_items)
        .filter(Boolean)
        .map(item => ({
          id: item.id,
          name: item.name
        })) || [];

      return {
        count: items.length,
        items
      } as IngredientUsageData;
    },
    enabled: !!companyId && !!ingredientName,
    retry: 0,
  });
};

export const useIngredientsUsage = (ingredientNames: string[]) => {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['ingredients-usage', ingredientNames, companyId],
    queryFn: async () => {
      if (!ingredientNames.length) return {};

      // Fetch all menu_item_ingredients for this company
      const { data, error } = await supabase
        .from('menu_item_ingredients')
        .select(`
          ingredient_name,
          menu_item_id,
          menu_items (
            id,
            name
          )
        `)
        .eq('company_id', companyId);

      if (error) throw error;

      // Create a normalized lookup map (lowercase, trimmed)
      const normalizedNames = new Map(
        ingredientNames.map(name => [name.toLowerCase().trim(), name])
      );

      // Initialize usage map with zero counts for all ingredients
      const usageMap: Record<string, IngredientUsageData> = {};
      ingredientNames.forEach(name => {
        usageMap[name] = { count: 0, items: [] };
      });

      // Map database results to ingredients (case-insensitive)
      (data || []).forEach(row => {
        const normalizedDbName = row.ingredient_name.toLowerCase().trim();
        const matchedName = normalizedNames.get(normalizedDbName);
        
        if (matchedName && row.menu_items) {
          // Avoid duplicates
          if (!usageMap[matchedName].items.find(item => item.id === row.menu_items.id)) {
            usageMap[matchedName].items.push({
              id: row.menu_items.id,
              name: row.menu_items.name,
            });
            usageMap[matchedName].count++;
          }
        }
      });

      return usageMap;
    },
    enabled: !!companyId && ingredientNames.length > 0,
  });
};
