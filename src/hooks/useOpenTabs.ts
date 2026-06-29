import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyId } from '@/hooks/useCompanyId';
import { isDeviceBound } from '@/utils/deviceBinding';

export interface OpenTab {
  orderId: string;
  orderNumber: number;
  assignmentType: 'table' | 'customer_name';
  tableNumber?: number;
  customerName?: string;
  itemCount: number;
  totalAmount: number;
  amountPaid: number;
  createdAt: string;
  isSplit: boolean;
  totalSplits: number;
  paidSplits: number;
}

export const useOpenTabs = () => {
  const { companyId } = useCompanyId();
  const bound = isDeviceBound();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['open-tabs', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      // Retry logic with exponential backoff
      const fetchWithRetry = async (attempt = 1): Promise<OpenTab[]> => {
        try {
          // PRIORITY 1: Check cache first for bound devices - trust DeviceDataManager
          if (bound && attempt === 1) {
            const cached = queryClient.getQueryData(['open-tabs', companyId]);
            if (cached && Array.isArray(cached) && cached.length > 0) {
              console.log('📦 useOpenTabs: Using cached tabs from DeviceDataManager:', cached.length);
              return cached;
            }
            console.log('📦 useOpenTabs: Cache empty or not seeded, falling back to direct query');
          }

          console.log('[useOpenTabs] Fetching open tabs for company:', companyId, `(attempt ${attempt})`);

          // First get orders without nested selects to avoid RLS issues
          const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('id, order_number, assignment_type, table_number, customer_name, total_amount, amount_paid, created_at')
            .eq('company_id', companyId)
            .eq('payment_status', 'unpaid')
            .order('created_at', { ascending: false })
            .limit(100);

          if (ordersError) {
            console.error('[useOpenTabs] Error fetching orders:', ordersError);
            throw ordersError;
          }

          console.log('[useOpenTabs] Found orders:', orders?.length || 0);

          if (!orders || orders.length === 0) return [];

          // Get order items separately to avoid RLS issues with nested selects
          const orderIds = orders.map(o => o.id);
          const { data: orderItems, error: itemsError } = await supabase
            .from('order_items')
            .select('order_id, id, quantity')
            .in('order_id', orderIds);

          if (itemsError) {
            console.error('[useOpenTabs] Error fetching order items:', itemsError);
          }

          // Get payments separately
          const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('order_id, split_index, total_splits')
            .in('order_id', orderIds);

          if (paymentsError) {
            console.error('[useOpenTabs] Error fetching payments:', paymentsError);
          }

          console.log('[useOpenTabs] Order items found:', orderItems?.length || 0);
          console.log('[useOpenTabs] Payments found:', payments?.length || 0);

          // Map order items and payments to their orders
          const itemsByOrder = (orderItems || []).reduce((acc, item) => {
            if (!acc[item.order_id]) acc[item.order_id] = [];
            acc[item.order_id].push(item);
            return acc;
          }, {} as Record<string, any[]>);

          const paymentsByOrder = (payments || []).reduce((acc, payment) => {
            if (!acc[payment.order_id]) acc[payment.order_id] = [];
            acc[payment.order_id].push(payment);
            return acc;
          }, {} as Record<string, any[]>);

          return orders.map(order => {
            const orderItemsList = itemsByOrder[order.id] || [];
            const orderPayments = paymentsByOrder[order.id] || [];
            
            // Check for split payments
            const splitPayments = orderPayments.filter(p => p.total_splits !== null);
            const isSplit = splitPayments.length > 0;
            const totalSplits = isSplit ? splitPayments[0].total_splits : 0;
            const paidSplits = new Set(splitPayments.map(p => p.split_index)).size;

            return {
              orderId: order.id,
              orderNumber: order.order_number,
              assignmentType: order.assignment_type as 'table' | 'customer_name',
              tableNumber: order.table_number || undefined,
              customerName: order.customer_name || undefined,
              itemCount: orderItemsList.reduce((sum, item) => sum + (item.quantity || 0), 0),
              totalAmount: order.total_amount || 0,
              amountPaid: order.amount_paid || 0,
              createdAt: order.created_at,
              isSplit,
              totalSplits,
              paidSplits,
            };
          }) as OpenTab[];

        } catch (error) {
          // Retry with exponential backoff
          if (attempt < 3) {
            const delay = 1000 * attempt;
            console.log(`⚠️ useOpenTabs: Retry ${attempt}/3 after ${delay}ms`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(attempt + 1);
          }
          
          console.error('[useOpenTabs] Final attempt failed:', error);
          throw error;
        }
      };

      return fetchWithRetry();
    },
    enabled: !!companyId,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnMount: 'always', // Always refetch on mount to prevent stale tabs from showing
  });
};
