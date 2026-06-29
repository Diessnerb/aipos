import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DeliveryOrder, DeliveryOrderItem } from '@/types/delivery';
import { CheckCircle, AlertCircle, Clock, Send, Package } from 'lucide-react';

interface OrderDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: DeliveryOrder;
  items: DeliveryOrderItem[];
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  open,
  onOpenChange,
  order,
  items
}) => {
  const getStatusBadge = () => {
    switch (order.status) {
      case 'draft':
        return <Badge variant="outline">📝 Draft</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800">✅ Approved</Badge>;
      case 'sent':
        return <Badge className="bg-purple-100 text-purple-800">📤 Sent</Badge>;
      case 'partially_received':
        return <Badge className="bg-amber-100 text-amber-800">⚠️ Partially Received</Badge>;
      case 'received':
        return <Badge className="bg-green-100 text-green-800">✅ Received</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">❌ Cancelled</Badge>;
      default:
        return <Badge>{order.status}</Badge>;
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <DialogTitle>Order #{order.order_number}</DialogTitle>
              {getStatusBadge()}
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground text-base">{order.supplier?.name || 'Unknown'}</p>
              <p>Created: {formatDate(order.order_date)}</p>
              {order.expected_delivery_date && (
                <p>Expected: {formatDate(order.expected_delivery_date)}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Items List */}
          <div className="border rounded-lg divide-y">
            {items.map(item => (
              <div key={item.id} className="p-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{item.ingredient_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.ordered_quantity} × £{(item.unit_cost || 0).toFixed(2)}
                  </p>
                </div>
                <p className="font-semibold whitespace-nowrap">
                  £{(item.total_cost || 0).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">Total</p>
              <p className="text-2xl font-bold">£{(order.total_cost || 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="border-t pt-4">
              <p className="font-semibold mb-2">Notes</p>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                {order.notes}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};