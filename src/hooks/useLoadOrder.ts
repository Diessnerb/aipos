import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrderBasket, CourseType } from '@/contexts/OrderBasketContext';
import { toast } from 'sonner';

export const useLoadOrder = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { 
    clearBasket, 
    addToBasket, 
    setOrderAssignment, 
    setLoadedOrderId,
    updateQuantity,
    setScheduledFor,
    setLoadedAmountPaid
  } = useOrderBasket();

  const loadOrder = async (orderId: string) => {
    setIsLoading(true);
    try {
      // Fetch order details
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          assignment_type,
          table_number,
          customer_name,
          scheduled_for,
          amount_paid,
          order_items (
            id,
            quantity,
            unit_price,
            course_type,
            notes,
            modifications,
            menu_items (
              id,
              name,
              description,
              price,
              category_id,
              image_urls,
              tags,
              allergens,
              card_color
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      if (!order) throw new Error('Order not found');

      // Clear existing basket
      clearBasket();

      // Set order assignment
      if (order.assignment_type === 'table' && order.table_number) {
        setOrderAssignment({
          type: 'table',
          tableNumber: order.table_number,
        });
      } else if (order.assignment_type === 'customer_name' && order.customer_name) {
        setOrderAssignment({
          type: 'customer_name',
          customerName: order.customer_name,
        });
      }

      // Load items into basket
      for (const orderItem of order.order_items || []) {
        if (!orderItem.menu_items) continue;

        // Parse modifications
        let modifications: any = null;
        if (orderItem.modifications) {
          if (typeof orderItem.modifications === 'string') {
            try {
              modifications = JSON.parse(orderItem.modifications);
            } catch (e) {
              modifications = null;
            }
          } else {
            modifications = orderItem.modifications;
          }
        }

        // Add item to basket (once, quantity will be added separately)
        const menuItem = {
          id: orderItem.menu_items.id,
          name: orderItem.menu_items.name,
          description: orderItem.menu_items.description,
          price: orderItem.menu_items.price,
          category_id: orderItem.menu_items.category_id,
          image_urls: orderItem.menu_items.image_urls,
          tags: orderItem.menu_items.tags,
          allergens: orderItem.menu_items.allergens,
          card_color: orderItem.menu_items.card_color,
        };

        // Add the item for each quantity
        for (let i = 0; i < orderItem.quantity; i++) {
          addToBasket(
            menuItem,
            orderItem.unit_price,
            modifications ? {
              selectedOptions: modifications.breakdown ? 
                modifications.breakdown.reduce((acc: any, b: any) => {
                  // Only add to selectedOptions if linkId exists (for backward compatibility)
                  if (b.linkId) {
                    acc[b.level] = b.linkId;
                  }
                  return acc;
                }, {}) : 
                undefined,
              breakdown: modifications.breakdown,
              ingredientModifications: modifications.ingredientModifications,
            } : undefined,
            (orderItem.course_type as CourseType) || 'main',
            orderItem.notes || undefined
          );
        }
      }

      // Store loaded order ID
      setLoadedOrderId(orderId);
      
      // Set the amount already paid on this order
      if (order.amount_paid && order.amount_paid > 0) {
        setLoadedAmountPaid(order.amount_paid);
      }
      
      // Set scheduled time if exists
      if (order.scheduled_for) {
        setScheduledFor(new Date(order.scheduled_for));
      }
    } catch (error) {
      console.error('Failed to load order:', error);
      toast.error('Failed to load order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return { loadOrder, isLoading };
};
