import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { offlineAwareInsert, offlineAwareUpdate } from '@/utils/offlineAwareSupabase';
import { useInstantData } from './useInstantData';
import type { DeliveryOrder, DeliveryOrderItem } from '@/types/delivery';

export const useDeliveryOrders = () => {
  const { pinUser } = useAuth();
  const companyId = pinUser?.company_id;
  const queryClient = useQueryClient();
  const { getInstantDeliveryOrders, getInstantDeliveryOrderItems, isDeviceLive } = useInstantData();

  // Try instant data first for orders
  const instantOrders = getInstantDeliveryOrders();
  const hasInstantOrders = instantOrders.isInstant && instantOrders.data;

  const { data: fetchedOrders = [], isLoading } = useQuery({
    queryKey: ['delivery_orders', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // For bound devices, use edge function
      const { isDeviceBound } = await import('@/utils/deviceBinding');
      if (isDeviceBound()) {
        const { data, error } = await supabase.functions.invoke('pin-delivery-orders-fetch', {
          body: { companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          return [];
        }

        return (data.orders || []) as DeliveryOrder[];
      }

      // Web users: direct query
      const { data, error } = await supabase
        .from('delivery_orders' as any)
        .select(`
          *,
          supplier:suppliers(*)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!companyId,
    initialData: () => queryClient.getQueryData(['delivery_orders', companyId]),
    retry: 0,
  });

  // Try instant data first for order items
  const instantOrderItems = getInstantDeliveryOrderItems();
  const hasInstantOrderItems = instantOrderItems.isInstant && instantOrderItems.data;

  const { data: fetchedOrderItems = [] } = useQuery({
    queryKey: ['delivery_order_items', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // For bound devices, use edge function
      const { isDeviceBound } = await import('@/utils/deviceBinding');
      if (isDeviceBound()) {
        const { data, error } = await supabase.functions.invoke('pin-delivery-order-items-fetch', {
          body: { companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          return [];
        }

        return (data.orderItems || []) as DeliveryOrderItem[];
      }

      // Web users: direct query
      const { data, error } = await supabase
        .from('delivery_order_items' as any)
        .select(`
          *,
          delivery_order:delivery_orders!inner(company_id)
        `)
        .eq('delivery_order.company_id', companyId);

      if (error) throw error;
      return data as any[];
    },
    enabled: !!companyId,
    initialData: () => queryClient.getQueryData(['delivery_order_items', companyId]),
    retry: 0,
  });

  const orders = (hasInstantOrders ? instantOrders.data : fetchedOrders) as DeliveryOrder[];
  const orderItems = (hasInstantOrderItems ? instantOrderItems.data : fetchedOrderItems) as DeliveryOrderItem[];

  const createOrder = useMutation({
    mutationFn: async (order: Omit<DeliveryOrder, 'id' | 'created_at' | 'updated_at' | 'supplier'>) => {
      const data = await offlineAwareInsert('delivery_orders', order);
      return data;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['delivery_orders', companyId] });
      toast.success('Order created successfully');
    },
    onError: (error) => {
      console.error('Error creating order:', error);
      toast.error('Failed to create order');
    },
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DeliveryOrder> }) => {
      const data = await offlineAwareUpdate('delivery_orders', id, updates);
      return data;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['delivery_orders', companyId] });
    },
    onError: (error) => {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    },
  });

  const approveOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const data = await offlineAwareUpdate('delivery_orders', orderId, {
        status: 'approved',
        approved_by: pinUser?.user_id,
        approved_at: new Date().toISOString(),
      });
      return data;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['delivery_orders', companyId] });
      toast.success('Order approved');
    },
    onError: (error) => {
      console.error('Error approving order:', error);
      toast.error('Failed to approve order');
    },
  });

  const addOrderItems = useMutation({
    mutationFn: async (items: Omit<DeliveryOrderItem, 'id' | 'created_at' | 'updated_at'>[]) => {
      const results = await Promise.all(
        items.map(item => offlineAwareInsert('delivery_order_items', item))
      );
      return results;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['delivery_order_items', companyId] });
    },
  });

  const updateOrderItem = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DeliveryOrderItem> }) => {
      const data = await offlineAwareUpdate('delivery_order_items', id, updates);
      return data;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['delivery_order_items', companyId] });
    },
  });

  return {
    orders,
    orderItems,
    isLoading: hasInstantOrders ? false : isLoading,
    createOrder: createOrder.mutate,
    updateOrder: updateOrder.mutate,
    approveOrder: approveOrder.mutate,
    addOrderItems: addOrderItems.mutate,
    updateOrderItem: updateOrderItem.mutate,
  };
};
