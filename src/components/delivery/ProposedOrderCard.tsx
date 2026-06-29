import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Edit2, Check, Send, AlertCircle } from 'lucide-react';
import { DeliveryOrder, DeliveryOrderItem } from '@/types/delivery';
import { offlineAwareUpdate } from '@/utils/offlineAwareSupabase';
import { toast } from 'sonner';
import { SendOrderDialog } from './SendOrderDialog';
import { OrderDetailsModal } from './OrderDetailsModal';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';

interface ProposedOrderCardProps {
  order: DeliveryOrder;
  items: DeliveryOrderItem[];
  onApprove: (orderId: string) => void;
  onSend: (orderId: string) => void;
}

export const ProposedOrderCard: React.FC<ProposedOrderCardProps> = ({
  order,
  items,
  onApprove,
  onSend
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<Record<string, number>>({});
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  // Calculate total item count (sum of all quantities)
  const totalItemCount = items.reduce((sum, item) => sum + item.ordered_quantity, 0);

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    setEditedItems(prev => ({ ...prev, [itemId]: newQuantity }));
  };

  const handleSaveChanges = async () => {
    try {
      // Update each edited item
      for (const [itemId, quantity] of Object.entries(editedItems)) {
        const item = items.find(i => i.id === itemId);
        if (!item) continue;

        await offlineAwareUpdate('delivery_order_items', itemId, {
          ordered_quantity: quantity,
          total_cost: (item.unit_cost || 0) * quantity
        });
      }

      // Recalculate order total
      const newTotal = items.reduce((sum, item) => {
        const qty = editedItems[item.id] ?? item.ordered_quantity;
        return sum + (item.unit_cost || 0) * qty;
      }, 0);

      await offlineAwareUpdate('delivery_orders', order.id, {
        total_cost: newTotal
      });

      queryClient.invalidateQueries({ queryKey: ['delivery_orders', companyId] });
      queryClient.invalidateQueries({ queryKey: ['delivery_order_items', companyId] });
      
      setIsEditing(false);
      setEditedItems({});
      toast.success('Order updated successfully');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    }
  };

  const handleApprove = () => {
    if (order.supplier?.minimum_order_value && order.total_cost! < order.supplier.minimum_order_value) {
      toast.error(`Order total is below minimum order value of £${order.supplier.minimum_order_value.toFixed(2)}`);
      return;
    }
    onApprove(order.id);
  };

  const getStatusBadge = () => {
    if (order.status === 'draft') {
      return <Badge variant="outline">📝 Draft</Badge>;
    }
    if (order.status === 'approved') {
      return <Badge className="bg-blue-100 text-blue-800">✅ Approved</Badge>;
    }
    return <Badge>{order.status}</Badge>;
  };

  const belowMinimum = order.supplier?.minimum_order_value && 
    order.total_cost! < order.supplier.minimum_order_value;

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader 
          className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors" 
          onClick={() => setShowDetailsModal(true)}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{order.supplier?.name || 'Unknown Supplier'}</h3>
                {getStatusBadge()}
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>Order #{order.order_number}</p>
                {order.expected_delivery_date && (
                  <p>Expected: {new Date(order.expected_delivery_date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}</p>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold">£{(order.total_cost || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{totalItemCount} items</p>
            </div>
          </div>

          {belowMinimum && (
            <div className="flex items-center gap-2 mt-3 text-sm text-amber-600 bg-amber-50 p-2 rounded">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Below minimum order value: £{order.supplier.minimum_order_value.toFixed(2)}</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full justify-between"
            >
              <span className="text-sm font-medium">
                {isExpanded ? 'Hide' : 'Show'} Items
              </span>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {isExpanded && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Order Items</span>
                  {!isEditing && order.status === 'draft' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit Quantities
                    </Button>
                  )}
                  {isEditing && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        setIsEditing(false);
                        setEditedItems({});
                      }}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveChanges}>
                        <Check className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  {items.map(item => {
                    const currentQty = editedItems[item.id] ?? item.ordered_quantity;
                    const lineTotal = (item.unit_cost || 0) * currentQty;

                    return (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.ingredient_name}</p>
                          <p className="text-xs text-muted-foreground">
                            £{(item.unit_cost || 0).toFixed(2)} per unit
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              value={currentQty}
                              onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                              className="w-20 h-8 text-sm"
                            />
                          ) : (
                            <span className="text-sm font-medium w-20 text-right">
                              {currentQty} units
                            </span>
                          )}
                          <span className="text-sm font-semibold w-20 text-right">
                            £{lineTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              {order.status === 'draft' && (
                <Button
                  onClick={handleApprove}
                  disabled={belowMinimum}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve Order
                </Button>
              )}
              {order.status === 'approved' && (
                <Button
                  onClick={() => setShowSendDialog(true)}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send to Supplier
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {order.supplier && (
        <SendOrderDialog
          open={showSendDialog}
          onOpenChange={setShowSendDialog}
          order={order}
          supplier={order.supplier}
          items={items}
          onSent={() => onSend(order.id)}
        />
      )}

      <OrderDetailsModal
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        order={order}
        items={items}
      />
    </>
  );
};