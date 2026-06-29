import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { KitchenMessageModal } from './KitchenMessageModal';
import { WastageModal } from '@/components/wastage/WastageModal';
import { useIngredients } from '@/hooks/useIngredients';
import { useMenuItems } from '@/hooks/useMenuItems';

export const KitchenActionButtons = () => {
  const { companyId } = useAuth();
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isWastageModalOpen, setIsWastageModalOpen] = useState(false);
  const [isSendingService, setIsSendingService] = useState(false);

  // Fetch real ingredients and menu items
  const { ingredients = [], isLoading: ingredientsLoading } = useIngredients();
  const { menuItems = [], loading: menuItemsLoading } = useMenuItems();

  // Combine ingredients and menu items into wastage format
  const wastageItems = useMemo(() => {
    // Map active ingredients
    const ingredientItems = ingredients
      .filter(ing => ing.is_active)
      .map(ing => ({
        id: ing.id,
        name: ing.name || ing.known_as || 'Unknown',
        type: 'ingredient' as const,
        unit_cost: ing.cost_price || 0,
      }));

    // Map menu items
    const menuItemsList = menuItems.map(item => ({
      id: item.id,
      name: item.name,
      type: 'menu_item' as const,
      unit_cost: 0, // Cost calculated from ingredients when logging wastage
    }));

    // Combine and sort alphabetically
    return [...ingredientItems, ...menuItemsList].sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }, [ingredients, menuItems]);

  const handleServiceRequest = async () => {
    if (!companyId) return;
    
    setIsSendingService(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('kitchen_service_requests')
        .insert({
          company_id: companyId,
          type: 'service',
          created_by: user?.user?.id,
        });
        
      if (error) throw error;
      
      toast.success('Service request sent to floor staff');
    } catch (error: any) {
      console.error('[KitchenActions] Service request failed:', error);
      toast.error('Failed to send service request');
    } finally {
      setIsSendingService(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        <Button
          onClick={handleServiceRequest}
          disabled={isSendingService}
          size="lg"
          className="shadow-lg hover:shadow-xl transition-shadow bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Bell className="h-5 w-5 mr-2" />
          Request Service
        </Button>
        
        <Button
          onClick={() => setIsMessageModalOpen(true)}
          size="lg"
          variant="secondary"
          className="shadow-lg hover:shadow-xl transition-shadow"
        >
          <MessageSquare className="h-5 w-5 mr-2" />
          Send Message
        </Button>

        <Button
          onClick={() => setIsWastageModalOpen(true)}
          size="lg"
          variant="outline"
          className="shadow-lg hover:shadow-xl transition-shadow border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          disabled={ingredientsLoading || menuItemsLoading}
        >
          <Trash2 className="h-5 w-5 mr-2" />
          Log Wastage
        </Button>
      </div>

      <KitchenMessageModal 
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
      />

      <WastageModal
        open={isWastageModalOpen}
        onOpenChange={setIsWastageModalOpen}
        location="kitchen"
        items={wastageItems}
      />
    </>
  );
};
