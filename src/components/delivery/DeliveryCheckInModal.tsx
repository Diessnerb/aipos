import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DeliveryOrder, DeliveryOrderItem } from '@/types/delivery';
import { offlineAwareUpdate } from '@/utils/offlineAwareSupabase';
import { LocalPeerSync } from '@/device/LocalPeerSync';
import { getBoundCompany } from '@/utils/deviceBinding';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { AlertCircle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface DeliveryCheckInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: DeliveryOrder;
  items: DeliveryOrderItem[];
}

interface ItemCheck {
  received: boolean;
  receivedQuantity: number;
  varianceType?: 'received' | 'partial' | 'missing' | 'damaged';
  varianceNotes?: string;
}

export const DeliveryCheckInModal: React.FC<DeliveryCheckInModalProps> = ({
  open,
  onOpenChange,
  order,
  items
}) => {
  const [checkedItems, setCheckedItems] = useState<Record<string, ItemCheck>>(() => {
    const initial: Record<string, ItemCheck> = {};
    items.forEach(item => {
      initial[item.id] = {
        received: false,
        receivedQuantity: item.ordered_quantity,
        varianceType: undefined,
        varianceNotes: ''
      };
    });
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedVariance, setExpandedVariance] = useState<Record<string, boolean>>({});
  const [selectAll, setSelectAll] = useState(false);
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const toggleVarianceExpanded = (itemId: string) => {
    setExpandedVariance(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setCheckedItems(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        updated[key] = { ...updated[key], received: checked };
      });
      return updated;
    });
  };

  const handleReceivedChange = (itemId: string, received: boolean) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], received }
    }));
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    let varianceType: ItemCheck['varianceType'];
    if (quantity === 0) {
      varianceType = 'missing';
    } else if (quantity < item.ordered_quantity) {
      varianceType = 'partial';
    } else if (quantity === item.ordered_quantity) {
      varianceType = 'received';
    }

    setCheckedItems(prev => ({
      ...prev,
      [itemId]: { 
        ...prev[itemId], 
        receivedQuantity: quantity,
        varianceType
      }
    }));
  };

  const handleVarianceNotesChange = (itemId: string, notes: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], varianceNotes: notes }
    }));
  };

  const handleConfirmDelivery = async () => {
    setIsSubmitting(true);
    try {
      const boundCompany = getBoundCompany();

      // Update each order item with received quantities
      for (const item of items) {
        const check = checkedItems[item.id];
        if (!check) continue;

        const variance = check.receivedQuantity - item.ordered_quantity;

        await offlineAwareUpdate('delivery_order_items', item.id, {
          received_quantity: check.receivedQuantity,
          variance_quantity: variance !== 0 ? variance : null,
          variance_cost: variance !== 0 ? (item.unit_cost || 0) * Math.abs(variance) : null,
          variance_type: check.varianceType,
          variance_notes: check.varianceNotes || null
        });

        // Update ingredient stock level
        const ingredient = await queryClient.getQueryData(['ingredients', companyId]);
        if (ingredient && Array.isArray(ingredient)) {
          const ing = ingredient.find((i: any) => i.id === item.ingredient_id);
          if (ing) {
            const newStockLevel = (ing.stock_level || 0) + check.receivedQuantity;
            await offlineAwareUpdate('ingredients', item.ingredient_id, {
              stock_level: newStockLevel,
              last_stock_update: new Date().toISOString()
            });
          }
        }
      }

      // Determine order status
      const allReceived = items.every(item => {
        const check = checkedItems[item.id];
        return check && check.receivedQuantity === item.ordered_quantity;
      });

      const newStatus = allReceived ? 'received' : 'partially_received';

      // Update order status
      await offlineAwareUpdate('delivery_orders', order.id, {
        status: newStatus,
        received_at: new Date().toISOString(),
        actual_delivery_date: new Date().toISOString()
      });

      // Broadcast to P2P peers
      if (LocalPeerSync.isConnected()) {
        await LocalPeerSync.broadcast({
          type: 'mutation',
          mutation: {
            table: 'delivery_orders',
            operation: 'update',
            data: { id: order.id, status: newStatus },
            timestamp: Date.now()
          },
          deviceId: localStorage.getItem('p2p-device-id') || 'unknown',
          companyId: boundCompany?.company_id || companyId,
          networkId: 'local'
        });
      }

      queryClient.invalidateQueries({ queryKey: ['delivery_orders', companyId] });
      queryClient.invalidateQueries({ queryKey: ['delivery_order_items', companyId] });
      queryClient.invalidateQueries({ queryKey: ['ingredients', companyId] });

      toast.success('Delivery checked in successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('Error checking in delivery:', error);
      toast.error('Failed to check in delivery');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVarianceIcon = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    const check = checkedItems[itemId];
    if (!item || !check) return null;

    if (check.receivedQuantity === item.ordered_quantity) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else if (check.receivedQuantity === 0) {
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    } else {
      return <AlertCircle className="h-4 w-4 text-amber-600" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Check In Delivery - Order #{order.order_number}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {order.supplier?.name} · {items.length} items
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {/* Column Headers */}
          <div className="flex items-center gap-3 py-2 border-b sticky top-0 bg-background text-xs font-medium text-muted-foreground mb-1">
            <div className="w-8 flex justify-center">
              <Checkbox
                checked={selectAll}
                onCheckedChange={handleSelectAll}
              />
            </div>
            <div className="flex-1 min-w-0">Item</div>
            <div className="w-20 text-right">Ordered</div>
            <div className="w-24 text-center">Received</div>
            <div className="w-20 text-center">Status</div>
          </div>

          {/* Items List */}
          <div className="space-y-0">
            {items.map(item => {
              const check = checkedItems[item.id];
              const hasVariance = check && check.receivedQuantity !== item.ordered_quantity;
              const variance = check ? check.receivedQuantity - item.ordered_quantity : 0;
              const isExpanded = expandedVariance[item.id];

              return (
                <div key={item.id}>
                  {/* Main Item Row */}
                  <div className="flex items-center gap-3 py-2 border-b hover:bg-muted/50 transition-colors">
                    <div className="w-8 flex justify-center">
                      <Checkbox
                        checked={check?.received}
                        onCheckedChange={(checked) => handleReceivedChange(item.id, checked as boolean)}
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      {hasVariance && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 p-0"
                          onClick={() => toggleVarianceExpanded(item.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      <span className="font-medium truncate text-sm">{item.ingredient_name}</span>
                    </div>
                    
                    <div className="w-20 text-right text-sm text-muted-foreground">
                      {item.ordered_quantity}
                    </div>
                    
                    <div className="w-24 flex justify-center">
                      <Input
                        type="number"
                        min="0"
                        value={check?.receivedQuantity ?? item.ordered_quantity}
                        onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                        className="w-20 h-8 text-center text-sm"
                      />
                    </div>
                    
                    <div className="w-20 flex items-center justify-center gap-1">
                      {hasVariance && (
                        <span className={`text-xs font-medium ${
                          variance > 0 ? 'text-green-600' : variance < 0 ? 'text-amber-600' : ''
                        }`}>
                          {variance > 0 ? '+' : ''}{variance}
                        </span>
                      )}
                      {getVarianceIcon(item.id)}
                    </div>
                  </div>

                  {/* Expandable Variance Notes */}
                  {hasVariance && isExpanded && (
                    <div className="bg-muted/30 px-3 py-2 border-b">
                      <div className="flex items-start gap-2">
                        <label className="text-xs text-muted-foreground min-w-[100px] pt-2">
                          Variance Notes:
                        </label>
                        <Textarea
                          placeholder="Explain the variance..."
                          value={check?.varianceNotes ?? ''}
                          onChange={(e) => handleVarianceNotesChange(item.id, e.target.value)}
                          className="flex-1 min-h-[60px] text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelivery} disabled={isSubmitting}>
            {isSubmitting ? 'Confirming...' : 'Confirm Delivery'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};