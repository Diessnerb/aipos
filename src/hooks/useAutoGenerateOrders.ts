import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { offlineAwareInsert } from '@/utils/offlineAwareSupabase';
import { LocalPeerSync } from '@/device/LocalPeerSync';
import { getBoundCompany } from '@/utils/deviceBinding';
import { useInstantData } from './useInstantData';
import { useSuppliers } from './useSuppliers';
import { useDeliverySettings } from './useDeliverySettings';
import * as StockPrediction from '@/services/stockPredictionService';

interface OrderItemToCreate {
  ingredient_id: string;
  ingredient_name: string;
  suggested_quantity: number;
  ordered_quantity: number;
  unit_cost?: number;
  total_cost?: number;
}

interface OrderToCreate {
  supplier_id: string;
  items: OrderItemToCreate[];
  total_cost: number;
}

export const useAutoGenerateOrders = () => {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const { getInstantIngredients } = useInstantData();
  const { suppliers } = useSuppliers();
  const { settings } = useDeliverySettings();

  const generateOrders = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company ID');

      // Get ingredients from cache
      const ingredientsResult = getInstantIngredients();
      const ingredients = (ingredientsResult.data || []) as any[];

      // Get delivery schedules (mock for now - would come from DB)
      const deliverySchedules: any[] = [];

      // Get usage analytics from cache (mock average usage for now)
      const usageAnalytics = ingredients.map((ing: any) => ({
        ingredient_id: ing.id,
        avg_daily_usage: 5, // Mock value - would calculate from ingredient_usage_analytics
        total_usage_last_30_days: 150
      }));

      // Group ingredients by supplier and calculate what needs ordering
      const ordersBySupplier = new Map<string, OrderToCreate>();

      for (const ingredient of ingredients) {
        if (!ingredient.supplier_id) continue;

        const supplier = suppliers.find(s => s.id === ingredient.supplier_id);
        if (!supplier || !supplier.is_active) continue;

        // Get usage data
        const usage = usageAnalytics.find(u => u.ingredient_id === ingredient.id);
        const avgDailyUsage = usage?.avg_daily_usage || 0;

        // Calculate next delivery date
        const nextDeliveryDate = StockPrediction.getNextDeliveryDate(supplier, deliverySchedules);
        const daysUntilDelivery = StockPrediction.getDaysUntilNextDelivery(nextDeliveryDate);

        // Check if needs reorder
        const lowStockThreshold = settings.low_stock_threshold_days || 3;
        if (!StockPrediction.needsReorder(ingredient, avgDailyUsage, daysUntilDelivery, lowStockThreshold)) {
          continue;
        }

        // Calculate order quantity
        const leadTimeBuffer = settings.lead_time_buffer_days || 2;
        const orderQuantity = StockPrediction.calculateReorderQuantity(
          ingredient,
          daysUntilDelivery,
          avgDailyUsage,
          leadTimeBuffer
        );

        if (orderQuantity <= 0) continue;

        // Add to order for this supplier
        if (!ordersBySupplier.has(supplier.id)) {
          ordersBySupplier.set(supplier.id, {
            supplier_id: supplier.id,
            items: [],
            total_cost: 0
          });
        }

        const order = ordersBySupplier.get(supplier.id)!;
        const itemCost = (ingredient.purchase_price || 0) * orderQuantity;
        
        order.items.push({
          ingredient_id: ingredient.id,
          ingredient_name: ingredient.name,
          suggested_quantity: orderQuantity,
          ordered_quantity: orderQuantity,
          unit_cost: ingredient.purchase_price,
          total_cost: itemCost
        });

        order.total_cost += itemCost;
      }

      // Create draft orders
      const createdOrders = [];
      const boundCompany = getBoundCompany();

      for (const [supplierId, orderData] of ordersBySupplier) {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (!supplier) continue;

        // Check minimum order value
        if (supplier.minimum_order_value && orderData.total_cost < supplier.minimum_order_value) {
          console.log(`Skipping order for ${supplier.name} - below minimum order value`);
          continue;
        }

        // Generate order number
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Calculate next delivery date
        const nextDeliveryDate = StockPrediction.getNextDeliveryDate(supplier, deliverySchedules);

        // Create order
        const newOrder = {
          company_id: companyId,
          supplier_id: supplierId,
          order_number: orderNumber,
          status: 'draft' as const,
          order_date: new Date().toISOString(),
          expected_delivery_date: nextDeliveryDate?.toISOString() || null,
          total_cost: orderData.total_cost,
          notes: 'Auto-generated order based on stock levels'
        };

        const orderResult = await offlineAwareInsert('delivery_orders', newOrder);
        const createdOrder = orderResult.data;

        if (createdOrder) {
          // Create order items
          for (const item of orderData.items) {
            await offlineAwareInsert('delivery_order_items', {
              delivery_order_id: createdOrder.id,
              ...item
            });
          }

          createdOrders.push(createdOrder);

          // Broadcast to P2P peers
          if (LocalPeerSync.isConnected()) {
            await LocalPeerSync.broadcast({
              type: 'mutation',
              mutation: {
                table: 'delivery_orders',
                operation: 'insert',
                data: createdOrder,
                timestamp: Date.now()
              },
              deviceId: localStorage.getItem('p2p-device-id') || 'unknown',
              companyId: boundCompany?.company_id || companyId,
              networkId: 'local'
            });
          }
        }
      }

      return createdOrders;
    },
    onSuccess: (orders) => {
      queryClient.invalidateQueries({ queryKey: ['delivery_orders', companyId] });
      queryClient.invalidateQueries({ queryKey: ['delivery_order_items', companyId] });
      
      if (orders.length > 0) {
        toast.success(`Generated ${orders.length} draft order${orders.length > 1 ? 's' : ''}`);
      } else {
        toast.info('No orders needed at this time');
      }
    },
    onError: (error) => {
      console.error('Error generating orders:', error);
      toast.error('Failed to generate orders');
    }
  });

  return {
    generateOrders: generateOrders.mutate,
    isGenerating: generateOrders.isPending
  };
};