import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompanyId } from './useCompanyId';
import { isDeviceBound } from '@/utils/deviceBinding';
import { useDeviceLiveLayer } from './useDeviceLiveLayer';

interface Order {
  id: string;
  external_pos_order_id: string;
  order_number?: number;
  table_number: number;
  table_numbers: number[];
  customer_name: string;
  status: string;
  total_amount: number;
  ordered_at: string;
  created_at: string;
  pos_metadata: any;
  reservation_id?: string;
  assignment_type?: string;
  reservation?: {
    id: string;
    status: string;
    customer_name: string;
  };
  order_items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    course_type?: 'starter' | 'main' | 'dessert';
    is_prepared?: boolean;
    menu_items?: {
      name: string;
    };
  }>;
}

export const useOrders = () => {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const { isActive: deviceLive } = useDeviceLiveLayer();
  const { toast } = useToast();
  const [displayLimit, setDisplayLimit] = useState(2000);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Order[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Device-aware query function
  const fetchOrders = async (): Promise<Order[]> => {
    if (!companyId || companyId === 'undefined') {
      console.warn('⚠️ useOrders: No valid companyId available');
      return [];
    }

    const bound = isDeviceBound();
    
    // PRIORITY 1: Check cache first (instant for bound devices)
    if (bound) {
      const cachedOrders = queryClient.getQueryData<Order[]>(['pos-orders', companyId]);
      if (cachedOrders && cachedOrders.length > 0) {
        console.log('📦 useOrders: Using cached orders:', cachedOrders.length);
        return cachedOrders;
      }
      
      // PRIORITY 2: Call edge function with isDeviceBound flag
      console.log('🌐 useOrders: Fetching via edge function (isDeviceBound: true)');
        const { data, error } = await supabase.functions.invoke('pin-orders-fetch', {
          body: { companyId, isDeviceBound: true, fetchAll: true }
        });

      if (error || !data?.success) {
        console.error('❌ useOrders: Edge function failed:', error);
        return cachedOrders || [];
      }

      // Don't overwrite cache if edge returns empty
      if ((!data.orders || data.orders.length === 0) && cachedOrders && cachedOrders.length > 0) {
        console.log('🛡️ Keeping existing cache; edge returned 0 orders');
        return cachedOrders;
      }

      console.log('✅ Orders fetched via edge function:', data.orders?.length || 0);
      return data.orders || [];
    }

    // PRIORITY 3: For authenticated web users, use direct query
    console.log('🌐 useOrders: Fetching via direct query (authenticated user)');
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        external_pos_order_id,
        order_number,
        table_number,
        table_numbers,
        customer_name,
        status,
        total_amount,
        ordered_at,
        created_at,
        pos_metadata,
        reservation_id,
        created_by_user:users!orders_created_by_fkey(id, full_name),
        payments(
          id,
          amount,
          method,
          paid_at,
          paid_by_user:users!payments_paid_by_fkey(id, full_name)
        ),
        reservation:reservations (
          id,
          status,
          customer_name
        ),
        order_items (
          id,
          quantity,
          unit_price,
          subtotal,
          course_type,
          is_prepared,
          menu_items (
            name
          )
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(displayLimit);

    if (error) {
      console.error('❌ useOrders: Direct query failed:', error);
      throw error;
    }

    return data as Order[] || [];
  };

  // Use React Query for data fetching
  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ['pos-orders', companyId, displayLimit],
    queryFn: fetchOrders,
    enabled: !!companyId && companyId !== 'undefined',
    staleTime: deviceLive ? Infinity : 30000,
    refetchOnWindowFocus: !deviceLive,
  });

  // Search function that queries database
  const searchOrders = async (
    query: string,
    filters?: {
      dateFrom?: string;
      dateTo?: string;
      tableNumber?: number;
      status?: 'paid' | 'unpaid';
    }
  ) => {
    if (!companyId || !query.trim()) {
      setSearchResults(null);
      setSearchQuery('');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchQuery(query);

    try {
      let queryBuilder = supabase
        .from('orders')
        .select(`
          id,
          external_pos_order_id,
          order_number,
          table_number,
          table_numbers,
          customer_name,
          status,
          total_amount,
          ordered_at,
          created_at,
          pos_metadata,
          reservation_id,
          assignment_type,
          created_by_user:users!orders_created_by_fkey(id, full_name),
          payments(
            id,
            amount,
            method,
            paid_at,
            paid_by_user:users!payments_paid_by_fkey(id, full_name)
          ),
          reservation:reservations(
            id,
            status,
            customer_name
          ),
          order_items(
            id,
            quantity,
            unit_price,
            subtotal,
            course_type,
            is_prepared,
            menu_items(name)
          )
        `)
        .eq('company_id', companyId);

      // Text search
      queryBuilder = queryBuilder.or(
        `order_number.ilike.%${query}%,customer_name.ilike.%${query}%,external_pos_order_id.ilike.%${query}%`
      );

      // Date range filter
      if (filters?.dateFrom) {
        queryBuilder = queryBuilder.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        // Add 1 day to include the entire end date
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        queryBuilder = queryBuilder.lt('created_at', endDate.toISOString());
      }

      // Table number filter
      if (filters?.tableNumber) {
        queryBuilder = queryBuilder.eq('table_number', filters.tableNumber);
      }

      // Status filter
      if (filters?.status) {
        queryBuilder = queryBuilder.eq('status', filters.status);
      }

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      setSearchResults(data as Order[] || []);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Search Error',
        description: 'Failed to search orders',
        variant: 'destructive',
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setIsSearching(false);
  };

  const loadMore = () => {
    setDisplayLimit(prev => prev + 100);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      
      await refetch(); // Refresh orders
      
      toast({
        title: 'Success',
        description: 'Order status updated',
      });

    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update order status',
        variant: 'destructive'
      });
    }
  };

  // Real-time subscription (only for non-bound devices)
  useEffect(() => {
    if (!companyId || companyId === 'undefined' || isDeviceBound()) return;

    const channel = supabase
      .channel('orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`
        },
        async () => {
          await queryClient.invalidateQueries({ queryKey: ['pos-orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  return {
    orders: searchResults !== null ? searchResults : orders,
    isLoading: isLoading || isSearching,
    updateOrderStatus,
    refetch,
    loadMore,
    hasMore: orders.length >= displayLimit && searchResults === null,
    searchOrders,
    clearSearch,
    isSearchActive: searchResults !== null,
    searchQuery,
  };
};