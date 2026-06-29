import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package } from 'lucide-react';
import { useDeliveryOrders } from '@/hooks/useDeliveryOrders';
import { OrderDetailsModal } from './OrderDetailsModal';

export const OrderHistoryTab: React.FC = () => {
  const { orders, orderItems } = useDeliveryOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  const completedOrders = orders.filter(order => 
    order.status === 'received' || order.status === 'cancelled'
  );

  const filteredOrders = completedOrders.filter(order =>
    order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    if (status === 'received') {
      return <Badge className="bg-green-100 text-green-800">✅ Received</Badge>;
    }
    if (status === 'cancelled') {
      return <Badge variant="destructive">❌ Cancelled</Badge>;
    }
    return <Badge>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Order History</h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Orders Found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try adjusting your search' : 'Completed orders will appear here'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-semibold">Order #</th>
                    <th className="text-left p-4 font-semibold">Supplier</th>
                    <th className="text-left p-4 font-semibold">Date</th>
                    <th className="text-right p-4 font-semibold">Total</th>
                    <th className="text-center p-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr 
                      key={order.id} 
                      className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedOrder(order.id)}
                    >
                      <td className="p-4 font-medium">{order.order_number}</td>
                      <td className="p-4">{order.supplier?.name || 'Unknown'}</td>
                      <td className="p-4">
                        {new Date(order.order_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="p-4 text-right font-semibold">
                        £{(order.total_cost || 0).toFixed(2)}
                      </td>
                      <td className="p-4 text-center">
                        {getStatusBadge(order.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedOrder && (
        <OrderDetailsModal
          open={!!selectedOrder}
          onOpenChange={(open) => !open && setSelectedOrder(null)}
          order={orders.find(o => o.id === selectedOrder)!}
          items={orderItems.filter(item => item.delivery_order_id === selectedOrder)}
        />
      )}
    </div>
  );
};
