import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, RefreshCw, Package } from 'lucide-react';
import { useDeliveryOrders } from '@/hooks/useDeliveryOrders';
import { useAutoGenerateOrders } from '@/hooks/useAutoGenerateOrders';
import { ManualOrderDialog } from './ManualOrderDialog';
import { ProposedOrderCard } from './ProposedOrderCard';

export const ProposedOrdersTab: React.FC = () => {
  const { orders, orderItems, approveOrder, updateOrder } = useDeliveryOrders();
  const { generateOrders, isGenerating } = useAutoGenerateOrders();
  const [manualOrderOpen, setManualOrderOpen] = useState(false);

  const proposedOrders = orders.filter(order => 
    order.status === 'draft' || order.status === 'approved'
  );

  const handleSendOrder = async (orderId: string) => {
    updateOrder({ 
      id: orderId, 
      updates: { 
        status: 'sent',
        sent_at: new Date().toISOString()
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Proposed Orders</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setManualOrderOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Manual Order
          </Button>
          <Button onClick={() => generateOrders()} disabled={isGenerating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating...' : 'Generate Orders Now'}
          </Button>
        </div>
      </div>

      {proposedOrders.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Proposed Orders</h3>
              <p className="text-muted-foreground mb-4">
                Generate orders automatically or create them manually
              </p>
              <Button onClick={() => generateOrders()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate Orders Now
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proposedOrders.map(order => {
            const items = orderItems.filter(item => item.delivery_order_id === order.id);
            return (
              <ProposedOrderCard
                key={order.id}
                order={order}
                items={items}
                onApprove={(id) => approveOrder(id)}
                onSend={handleSendOrder}
              />
            );
          })}
        </div>
      )}

      <ManualOrderDialog open={manualOrderOpen} onOpenChange={setManualOrderOpen} />
    </div>
  );
};
