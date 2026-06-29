import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Package, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isTomorrow } from 'date-fns';
import { offlineAwareUpdate } from '@/utils/offlineAwareSupabase';
import { useQueryClient } from '@tanstack/react-query';
import { useCompanyId } from '@/hooks/useCompanyId';

interface OrderItem {
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
      category_type?: string | null;
    };
  };
}

interface KitchenOrder {
  id: string;
  external_pos_order_id: string | null;
  table_number: number | null;
  customer_name: string | null;
  created_at: string;
  scheduled_for: string | null;
  assignment_type: string | null;
  reservation_id?: string | null;
  reservation?: {
    id: string;
    status: string;
    customer_name: string;
  };
  order_items: OrderItem[];
  _isPending?: boolean;
  _visibleItems?: OrderItem[];
}

interface KitchenOrderCardProps {
  order: KitchenOrder;
  currentTime: Date;
  courseStartTime?: string;
}

export const KitchenOrderCard = ({ order, currentTime, courseStartTime }: KitchenOrderCardProps) => {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const isPending = order._isPending;
  
  // Calculate elapsed time from scheduled pickup (for pre-orders) or course start
  const startTime = order.scheduled_for 
    ? new Date(order.scheduled_for)
    : new Date(courseStartTime || order.created_at);
  const elapsedMinutes = isPending 
    ? 0 // Don't count time during pending
    : Math.floor((currentTime.getTime() - startTime.getTime()) / 60000);

  const displayIdentifier = order.table_number 
    ? `Table ${order.table_number}`
    : order.customer_name || `Order ${order.external_pos_order_id || order.id.slice(0, 8)}`;


  // Use _visibleItems if provided, otherwise fall back to order_items
  const displayItems = order._visibleItems || order.order_items;
  
  // Robustly exclude drinks (safety net)
  const foodDisplayItems = displayItems.filter(item => {
    if (item.course_type === 'drinks') return false;
    const catType = item.menu_items?.menu_categories?.category_type?.toLowerCase?.();
    if (catType === 'drinks') return false;
    const catName = item.menu_items?.menu_categories?.name?.toLowerCase?.();
    if (catName && /(drink|beverage|wine|beer|cocktail|coffee|tea)/.test(catName)) return false;
    const tags = item.menu_items?.tags?.map(t => t.toLowerCase()) || [];
    if (tags.some(t => ['drink','drinks','beverage','beverages','wine','beer','cocktail','coffee','tea'].includes(t))) return false;
    const itemName = item.menu_items?.name?.toLowerCase?.();
    if (itemName && /(beer|wine|cocktail|coffee|tea|latte|espresso|cappuccino|soda|cola|lemonade|juice|water|spritz)/.test(itemName)) return false;
    return true;
  });
  
  // Early return for takeaway orders with no food items (only drinks)
  if (order.assignment_type === 'customer_name' && foodDisplayItems.length === 0) {
    return null;
  }
  
  // Group items by course, defaulting to 'main' if not specified
  const itemsByCourse = {
    starter: foodDisplayItems.filter(item => item.course_type === 'starter'),
    main: foodDisplayItems.filter(item => !item.course_type || item.course_type === 'main'),
    dessert: foodDisplayItems.filter(item => item.course_type === 'dessert'),
  };

  // Calculate total quantity for each course
  const getTotalQuantityForCourse = (items: OrderItem[]) => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const courseQuantities = {
    starter: getTotalQuantityForCourse(itemsByCourse.starter),
    main: getTotalQuantityForCourse(itemsByCourse.main),
    dessert: getTotalQuantityForCourse(itemsByCourse.dessert),
  };

  const handleReadyClick = async () => {
    try {
      const reservationStatus = order.reservation?.status;
      
      // Determine which course is currently being prepared
      let currentCourse: 'starter' | 'main' | 'dessert' | null = null;
      
      if (reservationStatus?.includes('waiting-for-starters')) {
        currentCourse = 'starter';
      } else if (reservationStatus?.includes('waiting-for-mains')) {
        currentCourse = 'main';
      } else if (reservationStatus?.includes('waiting-for-desserts')) {
        currentCourse = 'dessert';
      }
      
      if (!currentCourse) {
        // Fallback: no reservation link, mark order as ready
        await offlineAwareUpdate('orders', order.id, { kitchen_status: 'ready' });
        
        // Optimistic cache update: remove from kitchen display immediately
        if (queryClient && companyId) {
          queryClient.setQueryData(['kitchen-orders', companyId], (old: any) => {
            if (!Array.isArray(old)) return old;
            return old.filter((o: any) => o.id !== order.id);
          });
          
          // Invalidate related caches for instant updates elsewhere
          queryClient.invalidateQueries({ queryKey: ['open-tabs', companyId] });
          queryClient.invalidateQueries({ queryKey: ['kitchen-ready-orders', companyId] });
        }
        
        toast.success(`${displayIdentifier} is ready for service!`);
        return;
      }
      
      // Mark all items of current course as prepared
      const itemsToUpdate = order.order_items
        ?.filter(item => item.course_type === currentCourse && !item.is_prepared)
        .map(item => item.id) || [];
      
      if (itemsToUpdate.length > 0) {
        // Update each item individually since offlineAware doesn't support .in()
        for (const itemId of itemsToUpdate) {
          const { error: itemError } = await offlineAwareUpdate('order_items', itemId, { is_prepared: true });
          if (itemError) throw itemError;
        }
      }
      
      // Update reservation status to "ready in kitchen"
      const statusMap = {
        'starter': 'starters-ready-in-kitchen',
        'main': 'mains-ready-in-kitchen',
        'dessert': 'desserts-ready-in-kitchen',
      };
      
      if (order.reservation_id) {
        const { error: reservationError } = await offlineAwareUpdate('reservations', order.reservation_id, { status: statusMap[currentCourse] });
        
        if (reservationError) throw reservationError;
        
        // Optimistic cache update: remove from kitchen, update reservation caches
        if (queryClient && companyId) {
          queryClient.setQueryData(['kitchen-orders', companyId], (old: any) => {
            if (!Array.isArray(old)) return old;
            return old.filter((o: any) => o.id !== order.id);
          });
          
          // Invalidate reservation and timeline caches
          queryClient.invalidateQueries({ queryKey: ['reservations-date', companyId] });
          queryClient.invalidateQueries({ queryKey: ['kitchen-ready-courses', companyId] });
          queryClient.invalidateQueries({ queryKey: ['open-tabs', companyId] });
        }
      }
      
      const courseName = currentCourse.charAt(0).toUpperCase() + currentCourse.slice(1);
      toast.success(`${courseName}s ready for service!`);
    } catch (error) {
      console.error('Failed to mark course as ready:', error);
      toast.error('Failed to update order status.');
    }
  };

  // Helper to determine course opacity based on reservation status
  const getCourseOpacity = (courseType: 'starter' | 'main' | 'dessert') => {
    const reservationStatus = order.reservation?.status;
    if (!reservationStatus) return 'opacity-100';
    
    // Completed courses: 25% opacity
    if (courseType === 'starter') {
      if (reservationStatus.includes('main') || 
          reservationStatus.includes('dessert') ||
          reservationStatus.includes('clear-starters') ||
          reservationStatus.includes('eating-mains')) {
        return 'opacity-25';
      }
    }
    
    if (courseType === 'main') {
      if (reservationStatus.includes('dessert') ||
          reservationStatus.includes('clear-mains') ||
          reservationStatus.includes('eating-dessert')) {
        return 'opacity-25';
      }
    }
    
    return 'opacity-100'; // Active course
  };

  // Helper to show course completion badge
  const getCourseBadge = (courseType: 'starter' | 'main' | 'dessert') => {
    const items = itemsByCourse[courseType];
    if (items.length === 0) return null;
    
    const allPrepared = items.every(item => item.is_prepared);
    
    if (allPrepared) {
      return <Badge variant="outline" className="ml-2 text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700">✓ Ready</Badge>;
    }
    return null;
  };

  // Determine card border color based on elapsed time
  const getTimerColor = () => {
    // For scheduled orders: negative = early (green), 0-15 = on-time (yellow), 15+ = late (red)
    if (order.scheduled_for) {
      if (elapsedMinutes < 0) return 'text-green-600'; // Before pickup time
      if (elapsedMinutes <= 15) return 'text-yellow-600'; // Pickup window
      return 'text-red-600'; // Past pickup time
    }
    
    // For immediate orders (existing logic)
    if (elapsedMinutes < 10) return 'text-green-600';
    if (elapsedMinutes < 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBorderColor = () => {
    // Base border color based on timing
    let baseClass = '';
    if (isPending) {
      baseClass = 'border-blue-400 bg-blue-50/30 dark:bg-blue-950/20';
    } else if (elapsedMinutes < 10 || (order.scheduled_for && elapsedMinutes < 0)) {
      baseClass = 'border-green-500/20';
    } else if (elapsedMinutes < 20 || (order.scheduled_for && elapsedMinutes <= 15)) {
      baseClass = 'border-yellow-500/20';
    } else {
      baseClass = 'border-red-500/20';
    }
    
    // Add subtle amber accent for takeaway orders
    if (order.assignment_type === 'customer_name') {
      baseClass += ' border-l-4 border-l-amber-400 dark:border-l-amber-600';
    }
    
    return baseClass;
  };

  return (
    <Card className={`flex flex-col h-full border-2 ${getBorderColor()} transition-colors ${isPending ? 'opacity-75' : 'opacity-100'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex flex-col gap-1.5">
          {/* Takeaway Badge - Top line, above customer name */}
          {order.assignment_type === 'customer_name' && (
            <div>
              <Badge 
                variant="outline" 
                className="text-xs px-2 py-0.5 bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800"
              >
                <Package className="h-3 w-3 mr-1 inline" />
                TAKEAWAY
              </Badge>
            </div>
          )}
          
          {/* Order Identifier */}
          <div className="flex items-center gap-2">
            <div className="font-bold text-lg">{displayIdentifier}</div>
            
            {/* Pending Badge */}
            {isPending && (
              <Badge variant="secondary" className="bg-blue-500 text-white text-xs">
                PENDING
              </Badge>
            )}
          </div>
          
          {/* Scheduled Pickup Time - Only if pre-order */}
          {order.scheduled_for && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-medium">
                Pickup: {format(new Date(order.scheduled_for), 'h:mm a')}
              </span>
              {/* Date indicator for today/tomorrow/future */}
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted">
                {isToday(new Date(order.scheduled_for)) 
                  ? 'Today' 
                  : isTomorrow(new Date(order.scheduled_for))
                    ? 'Tomorrow'
                    : format(new Date(order.scheduled_for), 'MMM d')
                }
              </span>
            </div>
          )}
        </div>
        
        {/* Timer (right side) */}
        {!isPending && (
          <div className={`flex flex-col items-end ${getTimerColor()}`}>
            <div className="text-2xl font-bold tabular-nums">
              {elapsedMinutes < 0 && '-'}{Math.abs(elapsedMinutes)}
            </div>
            <div className="text-[10px] uppercase tracking-wide">min</div>
          </div>
        )}
      </div>

      {/* Order Items */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {order.assignment_type === 'customer_name' ? (
          /* TAKEAWAY: Single flat list without course separations */
          <div className="space-y-2">
            {foodDisplayItems.map((item) => (
              <div key={item.id} className="space-y-1 pl-2">
                {/* Main Item */}
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-base shrink-0">
                    {item.quantity}x
                  </span>
                  <span className="font-medium text-base">
                    {item.menu_items?.name || 'Unknown Item'}
                  </span>
                </div>

                {/* Product Link Selections (from breakdown) */}
                {item.modifications?.breakdown && item.modifications.breakdown.length > 0 && (
                  <div className="ml-6 space-y-0.5">
                    {item.modifications.breakdown
                      .filter(b => b.level > 0 && b.isModifier)
                      .map((breakdown, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground">
                          + {breakdown.optionName}
                        </div>
                      ))}
                  </div>
                )}

                {/* Ingredient Modifications */}
                {item.modifications?.ingredientModifications && item.modifications.ingredientModifications.length > 0 && (
                  <div className="ml-6 space-y-0.5">
                    {item.modifications.ingredientModifications.map((mod, idx) => (
                      <div
                        key={idx}
                        className={`text-sm font-medium ${
                          mod.modification_type === 'removed' 
                            ? 'text-red-600' 
                            : 'text-green-600'
                        }`}
                      >
                        {mod.modification_type === 'removed' ? '- ' : '+ '}
                        {mod.modification_type === 'extra' && mod.quantity > 1 && `${mod.quantity}x `}
                        {mod.ingredient_name}
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {item.notes && (
                  <div className="ml-6 mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-yellow-700 dark:text-yellow-300 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-900 dark:text-yellow-100 font-medium">
                        {item.notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* DINE-IN: Grouped by courses */
          <>
            {/* Starters Section */}
            {itemsByCourse.starter.length > 0 && (
              <div className={`space-y-2 ${getCourseOpacity('starter')}`}>
                <div className="flex items-center gap-2 pb-2 border-b-2 border-green-200 dark:border-green-900/50">
                  <span className="text-sm font-bold text-green-800 dark:text-green-200 uppercase tracking-wide">
                    🟢 STARTERS ({courseQuantities.starter}) {isPending && '(Coming Next)'}
                  </span>
                  {getCourseBadge('starter')}
                </div>
            {itemsByCourse.starter.map((item) => (
              <div key={item.id} className="space-y-1 pl-2">
                {/* Main Item */}
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-base shrink-0">
                    {item.quantity}x
                  </span>
                  <span className="font-medium text-base">
                    {item.menu_items?.name || 'Unknown Item'}
                  </span>
                </div>

                {/* Product Link Selections (from breakdown) */}
                {item.modifications?.breakdown && item.modifications.breakdown.length > 0 && (
                  <div className="ml-6 space-y-0.5">
                    {item.modifications.breakdown
                      .filter(b => b.level > 0 && b.isModifier)
                      .map((breakdown, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground">
                          + {breakdown.optionName}
                        </div>
                      ))}
                  </div>
                )}

                {/* Ingredient Modifications */}
                {item.modifications?.ingredientModifications && item.modifications.ingredientModifications.length > 0 && (
                  <div className="ml-6 space-y-0.5">
                    {item.modifications.ingredientModifications.map((mod, idx) => (
                      <div
                        key={idx}
                        className={`text-sm font-medium ${
                          mod.modification_type === 'removed' 
                            ? 'text-red-600' 
                            : 'text-green-600'
                        }`}
                      >
                        {mod.modification_type === 'removed' ? '- ' : '+ '}
                        {mod.modification_type === 'extra' && mod.quantity > 1 && `${mod.quantity}x `}
                        {mod.ingredient_name}
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {item.notes && (
                  <div className="ml-6 mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-yellow-700 dark:text-yellow-300 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-900 dark:text-yellow-100 font-medium">
                        {item.notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Mains Section */}
        {itemsByCourse.main.length > 0 && (
          <div className={`space-y-2 ${getCourseOpacity('main')}`}>
            <div className="flex items-center gap-2 pb-2 border-b-2 border-orange-200 dark:border-orange-900/50">
              <span className="text-sm font-bold text-orange-800 dark:text-orange-200 uppercase tracking-wide">
                🟠 MAINS ({courseQuantities.main}) {isPending && '(Coming Next)'}
              </span>
              {getCourseBadge('main')}
            </div>
            {itemsByCourse.main.map((item) => (
              <div key={item.id} className="space-y-1 pl-2">
                {/* Main Item */}
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-base shrink-0">
                    {item.quantity}x
                  </span>
                  <span className="font-medium text-base">
                    {item.menu_items?.name || 'Unknown Item'}
                  </span>
                </div>

                {/* Product Link Selections (from breakdown) */}
                {item.modifications?.breakdown && item.modifications.breakdown.length > 0 && (
                  <div className="ml-6 space-y-0.5">
                    {item.modifications.breakdown
                      .filter(b => b.level > 0 && b.isModifier)
                      .map((breakdown, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground">
                          + {breakdown.optionName}
                        </div>
                      ))}
                  </div>
                )}

                {/* Ingredient Modifications */}
                {item.modifications?.ingredientModifications && item.modifications.ingredientModifications.length > 0 && (
                  <div className="ml-6 space-y-0.5">
                    {item.modifications.ingredientModifications.map((mod, idx) => (
                      <div
                        key={idx}
                        className={`text-sm font-medium ${
                          mod.modification_type === 'removed' 
                            ? 'text-red-600' 
                            : 'text-green-600'
                        }`}
                      >
                        {mod.modification_type === 'removed' ? '- ' : '+ '}
                        {mod.modification_type === 'extra' && mod.quantity > 1 && `${mod.quantity}x `}
                        {mod.ingredient_name}
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {item.notes && (
                  <div className="ml-6 mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-yellow-700 dark:text-yellow-300 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-900 dark:text-yellow-100 font-medium">
                        {item.notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Desserts Section */}
        {itemsByCourse.dessert.length > 0 && (
          <div className={`space-y-2 ${getCourseOpacity('dessert')}`}>
            <div className="flex items-center gap-2 pb-2 border-b-2 border-purple-200 dark:border-purple-900/50">
              <span className="text-sm font-bold text-purple-800 dark:text-purple-200 uppercase tracking-wide">
                🟣 DESSERTS ({courseQuantities.dessert}) {isPending && '(Coming Next)'}
              </span>
              {getCourseBadge('dessert')}
            </div>
            {itemsByCourse.dessert.map((item) => (
              <div key={item.id} className="space-y-1 pl-2">
                {/* Main Item */}
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-base shrink-0">
                    {item.quantity}x
                  </span>
                  <span className="font-medium text-base">
                    {item.menu_items?.name || 'Unknown Item'}
                  </span>
                </div>

                {/* Product Link Selections (from breakdown) */}
                {item.modifications?.breakdown && item.modifications.breakdown.length > 0 && (
                  <div className="ml-6 space-y-0.5">
                    {item.modifications.breakdown
                      .filter(b => b.level > 0 && b.isModifier)
                      .map((breakdown, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground">
                          + {breakdown.optionName}
                        </div>
                      ))}
                  </div>
                )}

                {/* Ingredient Modifications */}
                {item.modifications?.ingredientModifications && item.modifications.ingredientModifications.length > 0 && (
                  <div className="ml-6 space-y-0.5">
                    {item.modifications.ingredientModifications.map((mod, idx) => (
                      <div
                        key={idx}
                        className={`text-sm font-medium ${
                          mod.modification_type === 'removed' 
                            ? 'text-red-600' 
                            : 'text-green-600'
                        }`}
                      >
                        {mod.modification_type === 'removed' ? '- ' : '+ '}
                        {mod.modification_type === 'extra' && mod.quantity > 1 && `${mod.quantity}x `}
                        {mod.ingredient_name}
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {item.notes && (
                  <div className="ml-6 mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-yellow-700 dark:text-yellow-300 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-900 dark:text-yellow-100 font-medium">
                        {item.notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>

      {/* Footer */}
      <div className="p-4 border-t">
        {isPending ? (
          // PENDING STATE: Show informational message
          <div className="w-full h-12 flex items-center justify-center text-sm font-medium text-muted-foreground bg-muted/50 rounded-md border border-dashed">
            <span className="flex items-center gap-2">
              ⏳ Waiting for previous course to be cleared
            </span>
          </div>
        ) : (
          // ACTIVE STATE: Show ready button
          <Button 
            onClick={handleReadyClick}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            READY FOR SERVICE
          </Button>
        )}
      </div>
    </Card>
  );
};
