
import React, { useState, useEffect } from 'react';
import { formatCustomerName } from '@/utils/nameUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, Check, Clock, CreditCard } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getOrderTypeColor, getOrderTypeLabel } from '@/utils/orderTypeColors';

export const OrderNotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for ready unpaid orders (UK workflow)
  const { data: readyOrders = [], refetch } = useQuery({
    queryKey: ['ready-unpaid-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            id,
            quantity,
            menu_items(name)
          )
        `)
        .eq('status', 'ready')
        .eq('payment_status', 'unpaid')
        .order('ready_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000, // Refresh every 5 seconds for notifications
  });

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('order-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order updated:', payload);
          refetch();
          
          // Show notification for newly ready orders
          if (payload.eventType === 'UPDATE' && 
              payload.new?.status === 'ready' && 
              payload.old?.status !== 'ready' &&
              payload.new?.payment_status === 'unpaid') {
            toast({
              title: "Order Ready for Payment!",
              description: `Order #${payload.new.id.slice(-6)} is ready and awaiting payment`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, toast]);

  // Mutation to mark order as paid
  const markAsPaidMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({ 
          payment_status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ready-unpaid-orders'] });
      queryClient.invalidateQueries({ queryKey: ['recent-orders'] });
      toast({
        title: "Payment marked as received",
        description: "Order payment has been recorded successfully",
      });
    },
    onError: (error) => {
      console.error('Error marking order as paid:', error);
      toast({
        title: "Error",
        description: "Failed to mark order as paid",
        variant: "destructive",
      });
    }
  });

  const getOrderAge = (readyAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(readyAt).getTime()) / 60000);
    if (minutes < 1) return 'Just ready';
    if (minutes === 1) return '1 minute ago';
    return `${minutes} minutes ago`;
  };

  const getAgeColor = (readyAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(readyAt).getTime()) / 60000);
    if (minutes < 5) return 'text-green-600';
    if (minutes < 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative"
        >
          <Bell className="w-4 h-4" />
          {readyOrders.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {readyOrders.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Ready for Payment</h3>
          <p className="text-xs text-gray-600">
            {readyOrders.length} order{readyOrders.length !== 1 ? 's' : ''} ready and awaiting payment
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {readyOrders.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm">All orders paid!</p>
              <p className="text-xs">No orders awaiting payment</p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {readyOrders.map((order: any) => {
                const orderTypeColors = getOrderTypeColor(order.order_type);
                
                return (
                  <div 
                    key={order.id}
                    className="border rounded-lg p-3 space-y-2 bg-yellow-50 border-yellow-200"
                    style={{
                      borderLeftWidth: '4px',
                      borderLeftColor: orderTypeColors.primary
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-sm">
                            Order #{order.id.slice(-6)}
                          </h4>
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{
                              backgroundColor: orderTypeColors.light,
                              color: orderTypeColors.text,
                              borderColor: orderTypeColors.primary
                            }}
                          >
                            {getOrderTypeLabel(order.order_type)}
                          </Badge>
                        </div>
                        <p className={`text-xs ${getAgeColor(order.ready_at)}`}>
                          <Clock className="w-3 h-3 inline mr-1" />
                          Ready {getOrderAge(order.ready_at)}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-semibold text-sm">£{order.total_amount.toFixed(2)}</p>
                        {order.order_type === 'dine_in' && order.table_number && (
                          <p className="text-xs text-gray-600">Table {order.table_number}</p>
                        )}
                        {order.order_type === 'room_service' && order.room_number && (
                          <p className="text-xs text-gray-600">Room {order.room_number}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-gray-600">
                      {order.customer_name && (
                        <p className="font-medium">{formatCustomerName(order.customer_name)}</p>
                      )}
                      <div className="mt-1">
                        {order.order_items?.slice(0, 2).map((item: any, index: number) => (
                          <div key={index} className="truncate">
                            • {item.quantity}x {item.menu_items?.name}
                          </div>
                        ))}
                        {(order.order_items?.length || 0) > 2 && (
                          <div className="text-gray-400">
                            +{(order.order_items?.length || 0) - 2} more items
                          </div>
                        )}
                      </div>
                    </div>

                    <Button 
                      size="sm" 
                      className="w-full bg-green-600 hover:bg-green-700" 
                      onClick={() => markAsPaidMutation.mutate(order.id)}
                      disabled={markAsPaidMutation.isPending}
                    >
                      <CreditCard className="w-3 h-3 mr-1" />
                      Mark as Paid
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
