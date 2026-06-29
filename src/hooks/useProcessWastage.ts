import { useAuth } from '@/components/AuthProvider';
import { BasketItem } from '@/contexts/OrderBasketContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { offlineAwareInsert, offlineAwareFetch } from '@/utils/offlineAwareSupabase';

export const useProcessWastage = () => {
  const { companyId, pinUser } = useAuth();
  const queryClient = useQueryClient();
  
  const mutation = useMutation({
    mutationFn: async ({ 
      basketItem, 
      location = 'kitchen',
      reason = 'overproduction',
      additionalNotes = ''
    }: { 
      basketItem: BasketItem; 
      location: 'kitchen' | 'bar';
      reason?: string;
      additionalNotes?: string;
    }) => {
      if (!companyId) throw new Error('No company selected');
      
      // 1. Fetch menu_item_ingredients for this menu item using offline-aware fetch
      const { data: menuItemIngredients, error: ingError } = await offlineAwareFetch(
        'menu_item_ingredients',
        [
          { column: 'menu_item_id', value: basketItem.menuItem.id },
          { column: 'company_id', value: companyId }
        ]
      );
      
      if (ingError) throw ingError;
      
      if (!menuItemIngredients || menuItemIngredients.length === 0) {
        throw new Error(`"${basketItem.menuItem.name}" has no linked ingredients`);
      }
      
      let totalCost = 0;
      const loggedIngredients: string[] = [];
      
      // Generate batch ID for this wastage event
      const wastageBatchId = crypto.randomUUID();
      
      // 2. For each ingredient, calculate quantity and cost, then log
      for (const ing of menuItemIngredients) {
        try {
          // Check if ingredient was removed by customer
          const wasRemoved = basketItem.configuration?.ingredientModifications?.some(
            mod => mod.ingredient_name === ing.ingredient_name && 
                   mod.modification_type === 'removed'
          );
          
          if (wasRemoved) continue;
          
          // Check for extras
          const extraMod = basketItem.configuration?.ingredientModifications?.find(
            mod => mod.ingredient_name === ing.ingredient_name && 
                   mod.modification_type === 'extra'
          );
          
          const extraQuantity = extraMod ? extraMod.quantity : 0;
          const totalQuantity = (ing.quantity + extraQuantity) * basketItem.quantity;
          
          // Lookup in master ingredients table using offline-aware fetch
          const { data: masterIngData, error: masterError } = await offlineAwareFetch(
            'ingredients',
            [
              { column: 'name', value: ing.ingredient_name },
              { column: 'company_id', value: companyId }
            ]
          );
          
          // Handle array result (take first item)
          const masterIng = Array.isArray(masterIngData) && masterIngData.length > 0 ? masterIngData[0] : null;
          
          if (masterError) {
            console.warn(`Error fetching master ingredient ${ing.ingredient_name}:`, masterError);
            continue;
          }
          
          if (!masterIng) {
            console.warn(`Ingredient not found in master table: ${ing.ingredient_name}`);
            continue;
          }
          
          // Calculate cost impact
          const costPrice = masterIng.cost_price || 0;
          const costImpact = totalQuantity * costPrice;
          totalCost += costImpact;
          
          // Format notes with menu item and reason
          const formattedNotes = [
            `Menu: ${basketItem.menuItem.name} (×${basketItem.quantity})`,
            additionalNotes ? `Notes: ${additionalNotes}` : null
          ].filter(Boolean).join(' | ');

          // Log wastage with batch ID
          await offlineAwareInsert('wastage_log', {
            company_id: companyId,
            ingredient_id: masterIng.id,
            quantity: totalQuantity,
            unit: masterIng.portion_type || 'Individual',
            reason: reason,
            cost_impact: costImpact,
            location: location,
            notes: formattedNotes,
            wastage_time: new Date().toISOString(),
            logged_by: pinUser?.user_id,
            wastage_batch_id: wastageBatchId,
          });
          
          // Also log to ingredient usage analytics
          try {
            await supabase.from('ingredient_usage_analytics' as any).insert({
              company_id: companyId,
              ingredient_id: masterIng.id,
              date: new Date().toISOString().split('T')[0],
              quantity_used: 0,
              quantity_wasted: totalQuantity,
              quantity_purchased: 0,
            });
          } catch (error) {
            console.error('Error updating analytics:', error);
          }
          
          loggedIngredients.push(ing.ingredient_name);
        } catch (error) {
          console.error(`Failed to log wastage for ${ing.ingredient_name}:`, error);
          // Continue with other ingredients
        }
      }
      
      return {
        success: true,
        ingredientsLogged: loggedIngredients.length,
        totalCost,
        ingredientNames: loggedIngredients
      };
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['wastage_log', companyId] });
      queryClient.refetchQueries({ queryKey: ['ingredient_usage_analytics', companyId] });
    },
  });
  
  const processItemAsWastage = async (
    basketItem: BasketItem,
    location: 'kitchen' | 'bar' = 'kitchen',
    reason: string = 'overproduction',
    additionalNotes: string = ''
  ) => {
    return mutation.mutateAsync({ basketItem, location, reason, additionalNotes });
  };
  
  return { 
    processItemAsWastage, 
    isProcessing: mutation.isPending 
  };
};
