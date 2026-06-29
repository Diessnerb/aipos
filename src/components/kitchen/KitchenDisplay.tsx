import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyId } from '@/hooks/useCompanyId';
import { isDeviceBound } from '@/utils/deviceBinding';
import { KitchenOrderCard } from './KitchenOrderCard';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { KitchenActionButtons } from './KitchenActionButtons';

interface KitchenOrder {
  id: string;
  external_pos_order_id: string | null;
  table_number: number | null;
  customer_name: string | null;
  created_at: string;
  scheduled_for: string | null;
  assignment_type: string | null;
  current_course_started_at: string | null;
  reservation_id: string | null;
  reservation?: {
    id: string;
    status: string;
    customer_name: string;
  };
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    course_type?: 'starter' | 'main' | 'dessert' | 'drinks';
    is_prepared?: boolean;
    notes?: string;
    modifications?: {
      breakdown?: Array<{
        level: number;
        optionName: string;
        price: number;
        isModifier: boolean;
      }>;
      ingredientModifications?: Array<{
        ingredient_id: string;
        ingredient_name: string;
        modification_type: 'removed' | 'extra';
        quantity: number;
        cost_per_unit: number;
      }>;
    };
    menu_items?: {
      id: string;
      name: string;
      category_id: string | null;
      tags?: string[] | null;
      menu_categories?: {
        id: string;
        name?: string | null;
        category_type: string;
      };
    };
  }>;
  _isPending?: boolean;
  _visibleItems?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    course_type?: 'starter' | 'main' | 'dessert' | 'drinks';
    is_prepared?: boolean;
    notes?: string;
    modifications?: any;
    menu_items?: {
      id: string;
      name: string;
      category_id: string | null;
      tags?: string[] | null;
      menu_categories?: {
        id: string;
        name?: string | null;
        category_type: string;
      };
    };
  }>;
}

export const KitchenDisplay = () => {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const { isActive: deviceLive } = useDeviceLiveLayer();
  const bound = isDeviceBound();

  // Update current time every minute for time tracking
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['kitchen-orders', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // PRIORITY 1: Check cache first (still return cache for instant display)
      // refetchOnMount will trigger background refetch to ensure freshness
      if (bound) {
        const cachedOrders = queryClient.getQueryData(['kitchen-orders', companyId]);
        if (cachedOrders && Array.isArray(cachedOrders) && cachedOrders.length > 0) {
          console.log('📦 KitchenDisplay: Using cached orders:', cachedOrders.length);
          return cachedOrders;
        }
        
        // PRIORITY 2: Call edge function with isDeviceBound flag
        console.log('🌐 KitchenDisplay: Fetching via edge function (isDeviceBound: true)');
        const { data, error } = await supabase.functions.invoke('pin-orders-fetch', {
          body: { companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ KitchenDisplay: Edge function failed:', error);
          return [];
        }

        console.log('✅ Orders fetched via edge function:', data.orders?.length || 0);
        return data.orders || [];
      }

      // Calculate 1 hour from now for pre-order filtering
      const oneHourFromNow = new Date();
      oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
      const oneHourFromNowISO = oneHourFromNow.toISOString();

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          external_pos_order_id,
          table_number,
          customer_name,
          created_at,
          scheduled_for,
          assignment_type,
          current_course_started_at,
          reservation_id,
          reservation:reservations (
            id,
            status,
            customer_name
          ),
          order_items!inner (
            id,
            quantity,
            unit_price,
            subtotal,
            course_type,
            is_prepared,
            modifications,
            notes,
            menu_items!inner (
              id,
              name,
              category_id,
              tags,
              menu_categories!inner (
                id,
                name,
                category_type
              )
            )
          )
        `)
        .eq('company_id', companyId)
        .in('kitchen_status', ['sent', 'preparing'])
        .or(`scheduled_for.is.null,scheduled_for.lte.${oneHourFromNowISO}`)
        
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      // Parse modifications if they were stringified (backward compatibility)
      // Also filter out ALL drinks using multiple checks for reliability
      const parsedData = (data || [])
        .map(order => ({
          ...order,
          order_items: order.order_items
            ?.filter(item => {
              // Filter out drinks using multiple checks for reliability
              
              // Check 1: explicit course_type field
              if (item.course_type === 'drinks') return false;
              
              // Check 2: menu category type
              const catType = item.menu_items?.menu_categories?.category_type?.toLowerCase?.();
              if (catType === 'drinks') return false;
              
              // Check 3: category name heuristics
              const catName = item.menu_items?.menu_categories?.name?.toLowerCase?.();
              if (catName && /(drink|beverage|wine|beer|cocktail|coffee|tea)/.test(catName)) return false;
              
              // Check 4: menu item tags (if any)
              const tags = item.menu_items?.tags?.map(t => t.toLowerCase()) || [];
              if (tags.some(t => ['drink','drinks','beverage','beverages','wine','beer','cocktail','coffee','tea'].includes(t))) return false;
              
              // Check 5: item name heuristics as last resort
              const itemName = item.menu_items?.name?.toLowerCase?.();
              if (itemName && /(beer|wine|cocktail|coffee|tea|latte|espresso|cappuccino|soda|cola|lemonade|juice|water|spritz)/.test(itemName)) return false;
              
              // Passed all checks - this is a food item
              return true;
            })
            .map(item => {
              let parsedModifications = item.modifications;
              
              // If modifications is a string, parse it
              if (typeof item.modifications === 'string') {
                try {
                  parsedModifications = JSON.parse(item.modifications);
                } catch (e) {
                  console.error('[KitchenDisplay] Failed to parse modifications:', e);
                  parsedModifications = null;
                }
              }
              
              return {
                ...item,
                modifications: parsedModifications,
              };
            }),
        }))
        .filter(order => order.order_items && order.order_items.length > 0); // Remove orders with only drinks
      
      return parsedData as KitchenOrder[];
    },
    enabled: !!companyId,
    refetchInterval: false, // Rely entirely on real-time updates
    refetchOnMount: 'always', // Always refetch on mount to prevent stale orders from showing
  });

  // Real-time subscription for order updates
  useEffect(() => {
    if (!companyId) return;
    
    // Skip if DeviceDataManager is handling this
    if (deviceLive) {
      console.log('[KitchenDisplay] Skipping local subscription - DeviceDataManager active');
      return;
    }

    console.log('[KitchenDisplay] Setting up local real-time subscription for company:', companyId);

    const channel = supabase
      .channel('kitchen-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('[KitchenDisplay] New order received:', payload);
          
          // Play ding sound for new orders
          import('@/device/KitchenAudioService').then(({ KitchenAudioService }) => {
            KitchenAudioService.playOrderDing();
          });
          
          queryClient.invalidateQueries({ 
            queryKey: ['kitchen-orders'],
            refetchType: 'active'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('[KitchenDisplay] Order updated:', payload);
          queryClient.invalidateQueries({ 
            queryKey: ['kitchen-orders'],
            refetchType: 'active'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_items',
        },
        (payload) => {
          console.log('[KitchenDisplay] Order item added:', payload);
          queryClient.invalidateQueries({ 
            queryKey: ['kitchen-orders'],
            refetchType: 'active'
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_items',
        },
        (payload) => {
          console.log('[KitchenDisplay] Order item updated:', payload);
          queryClient.invalidateQueries({ 
            queryKey: ['kitchen-orders'],
            refetchType: 'active'
          });
        }
      )
      .subscribe((status) => {
        console.log('[KitchenDisplay] Subscription status:', status);
      });

    return () => {
      console.log('[KitchenDisplay] Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient, deviceLive]);

  // Real-time subscription for reservation updates
  useEffect(() => {
    if (!companyId) return;
    
    // Skip if DeviceDataManager is handling this
    if (deviceLive) {
      console.log('[KitchenDisplay] Skipping reservation subscription - DeviceDataManager active');
      return;
    }

    console.log('[KitchenDisplay] Setting up reservation real-time subscription');

    const reservationChannel = supabase
      .channel('kitchen-reservation-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reservations',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('[KitchenDisplay] Reservation status changed:', payload);
          // Refresh kitchen orders when reservation progresses to next course
          queryClient.invalidateQueries({ 
            queryKey: ['kitchen-orders'],
            refetchType: 'active'
          });
        }
      )
      .subscribe((status) => {
        console.log('[KitchenDisplay] Reservation subscription status:', status);
      });

    return () => {
      console.log('[KitchenDisplay] Cleaning up reservation subscription');
      supabase.removeChannel(reservationChannel);
    };
  }, [companyId, queryClient, deviceLive]);

  // Robustly check if an item is a drink
  const isDrinkItem = (item: KitchenOrder['order_items'][0]): boolean => {
    if (item.course_type === 'drinks') return true;
    const catType = item.menu_items?.menu_categories?.category_type?.toLowerCase?.();
    if (catType === 'drinks') return true;
    const catName = item.menu_items?.menu_categories?.name?.toLowerCase?.();
    if (catName && /(drink|beverage|wine|beer|cocktail|coffee|tea)/.test(catName)) return true;
    const tags = item.menu_items?.tags?.map(t => t.toLowerCase()) || [];
    if (tags.some(t => ['drink','drinks','beverage','beverages','wine','beer','cocktail','coffee','tea'].includes(t))) return true;
    const itemName = item.menu_items?.name?.toLowerCase?.();
    if (itemName && /(beer|wine|cocktail|coffee|tea|latte|espresso|cappuccino|soda|cola|lemonade|juice|water|spritz)/.test(itemName)) return true;
    return false;
  };

  // Filter orders to show relevant courses based on reservation status
  const getVisibleOrders = (orders: KitchenOrder[]) => {
    return orders.map(order => {
      if (!order.order_items || order.order_items.length === 0) return null;
      
      // No reservation: show all food items (exclude drinks)
      if (!order.reservation_id || !order.reservation?.status) {
        const foodItems = order.order_items.filter(item => !isDrinkItem(item));
        // If takeaway order with only drinks, exclude it
        if (order.assignment_type === 'customer_name' && foodItems.length === 0) {
          return null;
        }
        return order;
      }
      
      const reservationStatus = order.reservation.status;
      
      // Determine if order is in pending state (course ready but not yet cleared)
      const isPending = reservationStatus.includes('-ready-in-kitchen');
      
      // Determine which course to show
      let visibleItems: typeof order.order_items = [];
      
      // ACTIVE: waiting-for-X statuses show current course
      if (reservationStatus === 'waiting-for-starters' || reservationStatus === 'seated') {
        visibleItems = order.order_items.filter(item => 
          item.course_type === 'starter' && 
          !item.is_prepared &&
          !isDrinkItem(item)
        );
      } else if (reservationStatus === 'waiting-for-mains') {
        visibleItems = order.order_items.filter(item => 
          (!item.course_type || item.course_type === 'main') && 
          !item.is_prepared &&
          !isDrinkItem(item)
        );
      } else if (reservationStatus === 'waiting-for-desserts') {
        visibleItems = order.order_items.filter(item => 
          item.course_type === 'dessert' && 
          !item.is_prepared &&
          !isDrinkItem(item)
        );
      }
      
      // PENDING: X-ready-in-kitchen shows NEXT course as preview
      else if (reservationStatus === 'starters-ready-in-kitchen' || 
               reservationStatus.includes('starters-served') ||
               reservationStatus.includes('eating-starters') ||
               reservationStatus === 'clear-starters') {
        // Show mains as preview while waiting for starters to be cleared
        visibleItems = order.order_items.filter(item => 
          (!item.course_type || item.course_type === 'main') && 
          !item.is_prepared &&
          !isDrinkItem(item)
        );
      } else if (reservationStatus === 'mains-ready-in-kitchen' ||
                 reservationStatus.includes('mains-served') ||
                 reservationStatus.includes('eating-mains') ||
                 reservationStatus === 'clear-mains') {
        // Show desserts as preview while waiting for mains to be cleared
        visibleItems = order.order_items.filter(item => 
          item.course_type === 'dessert' && 
          !item.is_prepared &&
          !isDrinkItem(item)
        );
      } else if (reservationStatus === 'desserts-ready-in-kitchen' ||
                 reservationStatus.includes('desserts-served') ||
                 reservationStatus.includes('eating-dessert') ||
                 reservationStatus === 'clear-desserts') {
        // No more courses after desserts, don't show
        visibleItems = [];
      }
      
      if (visibleItems.length === 0) return null;
      
      return {
        ...order,
        _isPending: isPending,
        _visibleItems: visibleItems,
      };
    }).filter(Boolean) as KitchenOrder[];
  };

  const foodOrders = getVisibleOrders(orders);
  
  console.debug(`[KitchenDisplay] Filtered ${orders.length} orders down to ${foodOrders.length} orders with food items`);

  // Sort by pending status first (active orders come first), then by time elapsed (oldest first)
  const sortedOrders = [...foodOrders].sort((a, b) => {
    // Active orders come first, pending orders go to end
    if (a._isPending !== b._isPending) {
      return a._isPending ? 1 : -1;
    }
    // Within same group, sort by created_at (oldest first)
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-muted-foreground">Loading kitchen orders...</div>
      </div>
    );
  }

  if (sortedOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-2xl font-semibold text-muted-foreground mb-2">No Active Orders</div>
          <div className="text-sm text-muted-foreground">Kitchen is clear</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden p-6 relative">
      <div className="flex gap-4 h-full">
        {sortedOrders.map((order) => (
          <div key={order.id} className="flex-shrink-0 w-60 sm:w-72 h-full">
            <KitchenOrderCard
              order={order}
              currentTime={currentTime}
              courseStartTime={order.current_course_started_at || order.created_at}
            />
          </div>
        ))}
        
        {/* Placeholder cards for scrolling room */}
        <div key="placeholder-1" className="flex-shrink-0 w-60 sm:w-72 h-full" />
        <div key="placeholder-2" className="flex-shrink-0 w-60 sm:w-72 h-full" />
      </div>
      
      <KitchenActionButtons />
    </div>
  );
};
