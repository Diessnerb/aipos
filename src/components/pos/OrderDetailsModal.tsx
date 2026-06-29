import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { OrderItemDetailModal } from './OrderItemDetailModal';
import { RefreshCw, Printer, ShoppingCart, Crown } from 'lucide-react';
import { useOrderBasket } from '@/contexts/OrderBasketContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  modifications?: {
    selectedOptions?: Record<string, string>;
    breakdown?: Array<{
      level: number;
      optionName: string;
      price: number;
      isModifier: boolean;
    }>;
    ingredientModifications?: Array<{
      ingredient_id: string;
      ingredient_name: string;
      modification_type: 'removed' | 'extra';
      quantity: number;
      cost_per_unit: number;
    }>;
  };
  menu_items?: {
    name: string;
    allergens?: string[];
  };
}

interface Order {
  id: string;
  external_pos_order_id: string;
  table_number: number;
  customer_name: string;
  status: string;
  total_amount: number;
  ordered_at: string;
  order_items?: OrderItem[];
}

interface OrderDetailsModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose
}) => {
  const [selectedOrderItem, setSelectedOrderItem] = useState<OrderItem | null>(null);
  const [isItemDetailModalOpen, setIsItemDetailModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setBasketItems, setLoadedOrderId, setOrderAssignment, setScheduledFor } = useOrderBasket();
  const { toast } = useToast();

  const handleItemClick = (item: OrderItem) => {
    setSelectedOrderItem(item);
    setIsItemDetailModalOpen(true);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleOpenInPOS = async () => {
    setIsLoading(true);
    try {
      // Fetch complete order data with items and payment information
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          id,
          quantity,
          unit_price,
          subtotal,
          modifications,
          notes,
          course_type,
          menu_items (
            id,
            name,
            price,
            description,
            category_id,
            tags,
            allergens,
            card_color,
            image_urls
          )
        `)
        .eq('order_id', order.id);

      if (itemsError) throw itemsError;

      // Fetch payment items to calculate what's been paid
      const orderItemIds = orderItems?.map(item => item.id) || [];
      const { data: paymentItems, error: paymentError } = await supabase
        .from('payment_items')
        .select('order_item_id, quantity')
        .in('order_item_id', orderItemIds);

      if (paymentError) throw paymentError;

      // Calculate paid quantities per item
      const paidQuantities = (paymentItems || []).reduce((acc, pi) => {
        acc[pi.order_item_id] = (acc[pi.order_item_id] || 0) + pi.quantity;
        return acc;
      }, {} as Record<string, number>);

      // Transform to BasketItem format
      const basketItems = (orderItems || []).map(item => {
        const mods = item.modifications as any;
        return {
          id: `${item.id}-${Date.now()}`, // Unique ID for basket
          menuItem: {
            id: item.menu_items?.id || '',
            name: item.menu_items?.name || 'Unknown Item',
            price: item.unit_price,
            description: item.menu_items?.description || null,
            category_id: item.menu_items?.category_id || null,
            tags: item.menu_items?.tags || null,
            allergens: item.menu_items?.allergens || null,
            card_color: item.menu_items?.card_color || null,
            image_urls: item.menu_items?.image_urls || undefined,
          },
          quantity: item.quantity,
          quantityPaid: paidQuantities[item.id] || 0,
          unitPrice: item.unit_price,
          totalPrice: item.subtotal || item.quantity * item.unit_price,
          courseType: (item.course_type as 'starter' | 'main' | 'dessert') || 'main',
          notes: item.notes || undefined,
          configuration: mods ? {
            selectedOptions: mods.selectedOptions || {},
            breakdown: mods.breakdown || [],
            ingredientModifications: mods.ingredientModifications || [],
          } : undefined,
        };
      });

      // Load into basket context
      setBasketItems(basketItems);
      setLoadedOrderId(order.id);
      
      // Set order assignment (table or customer name)
      if (order.table_number) {
        setOrderAssignment({ type: 'table', tableNumber: order.table_number });
      } else if (order.customer_name) {
        setOrderAssignment({ type: 'customer_name', customerName: order.customer_name });
      }

      // Navigate to POS
      onClose();
      navigate('/pos');
    } catch (error: any) {
      console.error('Error loading order into POS:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Order #{order.external_pos_order_id} • {formatDateTime(order.ordered_at)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Customer Info */}
            {(order as any).customer && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Customer</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{(order as any).customer.name}</p>
                      {(order as any).customer.vip_status && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Crown className="h-3 w-3 text-yellow-500" />
                          VIP
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <Separator />
            {/* Order Items */}
            {order.order_items && order.order_items.length > 0 ? (
              <div className="space-y-2">
                {order.order_items.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex justify-between items-center gap-2 p-2 bg-muted rounded-lg"
                  >
                    <div 
                      className="flex items-center gap-2 flex-1 cursor-pointer hover:bg-accent rounded-md p-1 -m-1 transition-colors"
                      onClick={() => handleItemClick(item)}
                    >
                      <Badge variant="secondary" className="font-mono">
                        {item.quantity}
                      </Badge>
                      <span className="font-medium">{item.menu_items?.name || 'Unknown Item'}</span>
                      {item.modifications && (
                        <span className="text-xs text-muted-foreground">+ extras</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">£{(item.subtotal || item.quantity * item.unit_price).toFixed(2)}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Refund item:', item.id);
                        }}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Refund
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No items in this order</p>
            )}

            {/* Total */}
            <Separator />
            <div className="flex justify-between items-center pt-2">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-xl font-bold text-emerald-600">
                £{order.total_amount.toFixed(2)}
              </span>
            </div>

            {/* Order Actions */}
            <Separator />
            
            {/* Open in POS button for unpaid orders */}
            {order.status !== 'paid' && (
              <>
                <Button
                  className="w-full"
                  onClick={handleOpenInPOS}
                  disabled={isLoading}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {isLoading ? 'Loading...' : 'Open Order in POS'}
                </Button>
                <Separator />
              </>
            )}
            
            <div className="pt-2 grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  console.log('Full refund for order:', order.id);
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Full Refund
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  console.log('Print receipt for order:', order.id);
                }}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Item Detail Modal */}
      <OrderItemDetailModal
        orderItem={selectedOrderItem}
        isOpen={isItemDetailModalOpen}
        onClose={() => setIsItemDetailModalOpen(false)}
      />
    </>
  );
};