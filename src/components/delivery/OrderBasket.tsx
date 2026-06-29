import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Minus, Plus, Trash2, AlertCircle, Package } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useSuppliers } from '@/hooks/useSuppliers';
import { offlineAwareInsert } from '@/utils/offlineAwareSupabase';
import { LocalPeerSync } from '@/device/LocalPeerSync';
import { getBoundCompany } from '@/utils/deviceBinding';
import { toast } from 'sonner';
import { Ingredient } from '@/types/ingredients';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface BasketItem {
  ingredient: Ingredient;
  quantity: number;
  supplierId: string;
  supplierName: string;
}

interface OrderBasketProps {
  items: BasketItem[];
  onUpdateQuantity: (ingredientId: string, quantity: number) => void;
  onRemoveItem: (ingredientId: string) => void;
  onOrdersCreated: () => void;
}

export const OrderBasket: React.FC<OrderBasketProps> = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onOrdersCreated
}) => {
  const { companyId } = useAuth();
  const { suppliers } = useSuppliers();
  const queryClient = useQueryClient();

  // Group items by supplier
  const itemsBySupplier = useMemo(() => {
    const groups = new Map<string, { supplier: any; items: BasketItem[]; total: number }>();

    items.forEach(item => {
      const supplier = suppliers.find(s => s.id === item.supplierId);
      if (!supplier) return;

      if (!groups.has(item.supplierId)) {
        groups.set(item.supplierId, {
          supplier,
          items: [],
          total: 0
        });
      }

      const group = groups.get(item.supplierId)!;
      group.items.push(item);
      group.total += (item.ingredient.purchase_price || 0) * item.quantity;
    });

    return Array.from(groups.values());
  }, [items, suppliers]);

  const createOrders = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company ID');
      
      const createdOrders = [];
      const boundCompany = getBoundCompany();

      // Get count of existing orders to generate sequential numbers
      const { supabase } = await import('@/integrations/supabase/client');
      const { count: existingOrderCount } = await supabase
        .from('delivery_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

      let orderCounter = (existingOrderCount || 0) + 1;

      for (const group of itemsBySupplier) {
        // Simple sequential order number
        const orderNumber = String(orderCounter);
        orderCounter++;

        // Create order
        const newOrder = {
          company_id: companyId,
          supplier_id: group.supplier.id,
          order_number: orderNumber,
          status: 'draft' as const,
          order_date: new Date().toISOString(),
          total_cost: group.total,
          notes: 'Manual order entry'
        };

        const orderResult = await offlineAwareInsert('delivery_orders', newOrder);
        const createdOrder = orderResult.data;

        if (!createdOrder) {
          throw new Error(`Failed to create order for ${group.supplier.name}`);
        }

        // Create order items with error handling
        for (const item of group.items) {
          const itemResult = await offlineAwareInsert('delivery_order_items', {
            delivery_order_id: createdOrder.id,
            ingredient_id: item.ingredient.id,
            ingredient_name: item.ingredient.name,
            ordered_quantity: item.quantity,
            suggested_quantity: item.quantity,
            unit_cost: item.ingredient.purchase_price,
            total_cost: (item.ingredient.purchase_price || 0) * item.quantity
          });

          if (itemResult.error) {
            console.error('Failed to create order item:', itemResult.error);
            throw new Error(`Failed to add ${item.ingredient.name} to order`);
          }
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

      return createdOrders;
    },
    onSuccess: (orders) => {
      // Immediately add new orders to cache for instant UI update
      queryClient.setQueryData(['delivery_orders', companyId], (old: any[] = []) => {
        return [...orders, ...old];
      });
      
      // Then refetch to get complete data with supplier info
      queryClient.refetchQueries({ queryKey: ['delivery_orders', companyId] });
      queryClient.refetchQueries({ queryKey: ['delivery_order_items', companyId] });
      toast.success(`Created ${orders.length} draft order${orders.length > 1 ? 's' : ''}`);
      onOrdersCreated();
    },
    onError: (error) => {
      console.error('Error creating orders:', error);
      toast.error('Failed to create orders');
    }
  });

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Your basket is empty</p>
          <p className="text-xs mt-1">Add ingredients to create orders</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6">
          {itemsBySupplier.map(group => (
            <div key={group.supplier.id} className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b">
                <h4 className="font-semibold">{group.supplier.name}</h4>
                <span className="text-sm font-semibold">£{group.total.toFixed(2)}</span>
              </div>

              {group.supplier.minimum_order_value && group.total < group.supplier.minimum_order_value && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Minimum order: £{group.supplier.minimum_order_value.toFixed(2)}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                {group.items.map(item => (
                  <div key={item.ingredient.id} className="flex items-center gap-2 p-2 rounded bg-background border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.ingredient.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} {item.ingredient.known_as || item.ingredient.stock_unit || 'unit'}{item.quantity !== 1 ? 's' : ''} @ £{(item.ingredient.purchase_price || 0).toFixed(2)} = £{((item.ingredient.purchase_price || 0) * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpdateQuantity(item.ingredient.id, item.quantity - 1)}
                        className="h-7 w-7 p-0"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpdateQuantity(item.ingredient.id, item.quantity + 1)}
                        className="h-7 w-7 p-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemoveItem(item.ingredient.id)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-6 border-t bg-background">
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold">Total ({itemsBySupplier.length} order{itemsBySupplier.length > 1 ? 's' : ''})</span>
          <span className="text-lg font-bold">
            £{itemsBySupplier.reduce((sum, g) => sum + g.total, 0).toFixed(2)}
          </span>
        </div>
        <Button
          onClick={() => createOrders.mutate()}
          disabled={createOrders.isPending}
          className="w-full"
        >
          {createOrders.isPending ? 'Creating Orders...' : 'Create Draft Orders'}
        </Button>
      </div>
    </>
  );
};