import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, CheckCircle } from 'lucide-react';
import { useDeliveryOrders } from '@/hooks/useDeliveryOrders';
import { DeliveryCheckInModal } from './DeliveryCheckInModal';

export const PendingDeliveriesTab: React.FC = () => {
  const { orders, orderItems } = useDeliveryOrders();
  const [checkInOrder, setCheckInOrder] = useState<string | null>(null);

  const pendingOrders = orders.filter(order => 
    order.status === 'sent' || order.status === 'approved' || order.status === 'partially_received'
  );

  const getStatusColor = (status: string) => {
    const colors = {
      approved: 'bg-green-100 text-green-800',
      sent: 'bg-yellow-100 text-yellow-800',
      partially_received: 'bg-blue-100 text-blue-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      approved: '🟢 Approved',
      sent: '🟡 Sent',
      partially_received: '🔵 Partially Received',
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Pending Deliveries</h2>

      {pendingOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pending Deliveries</h3>
              <p className="text-muted-foreground">
                All deliveries have been completed
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-semibold">{order.supplier?.name || 'Unknown'}</h3>
                      <p className="text-sm text-muted-foreground">{order.order_number}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due:</span>
                    <span className="font-medium">
                      {order.expected_delivery_date 
                        ? new Date(order.expected_delivery_date).toLocaleDateString('en-GB', { 
                            month: 'short', 
                            day: 'numeric' 
                          })
                        : 'N/A'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-bold">£{(order.total_cost || 0).toFixed(2)}</span>
                  </div>

                  <div className="pt-2">
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>
                </div>

                <Button className="w-full mt-4" size="sm" onClick={() => setCheckInOrder(order.id)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Check In
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {checkInOrder && (
        <DeliveryCheckInModal
          open={!!checkInOrder}
          onOpenChange={(open) => !open && setCheckInOrder(null)}
          order={orders.find(o => o.id === checkInOrder)!}
          items={orderItems.filter(item => item.delivery_order_id === checkInOrder)}
        />
      )}
    </div>
  );
};
