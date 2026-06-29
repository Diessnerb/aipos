import { Ingredient } from '@/types/ingredients';
import { Supplier } from '@/types/delivery-db';

interface IngredientUsageAnalytics {
  ingredient_id: string;
  avg_daily_usage: number;
  total_usage_last_30_days: number;
}

/**
 * Calculate days until ingredient stockout based on current level and average usage
 */
export const calculateDaysUntilStockout = (
  ingredient: Ingredient,
  avgDailyUsage: number
): number | null => {
  if (!ingredient.stock_level || avgDailyUsage <= 0) return null;
  return Math.floor(ingredient.stock_level / avgDailyUsage);
};

/**
 * Calculate optimal reorder quantity for an ingredient
 */
export const calculateReorderQuantity = (
  ingredient: Ingredient,
  daysUntilNextDelivery: number,
  avgDailyUsage: number,
  leadTimeBufferDays: number = 2
): number => {
  // Calculate usage until next delivery + buffer
  const totalDays = daysUntilNextDelivery + leadTimeBufferDays;
  const projectedUsage = avgDailyUsage * totalDays;
  
  // Calculate how much we need to order
  const currentStock = ingredient.stock_level || 0;
  const minimumStock = 0; // Would come from ingredient settings
  
  // Order enough to cover projected usage + maintain minimum stock
  const orderQuantity = projectedUsage + minimumStock - currentStock;
  
  // Round up to nearest whole unit
  return Math.max(0, Math.ceil(orderQuantity));
};

/**
 * Get next delivery date for a supplier based on their schedule
 */
export const getNextDeliveryDate = (
  supplier: Supplier,
  deliverySchedules: any[]
): Date | null => {
  if (supplier.scheduling_mode === 'lead_time') {
    // For lead time mode, calculate based on lead_time_days
    const today = new Date();
    const nextDelivery = new Date(today);
    nextDelivery.setDate(nextDelivery.getDate() + supplier.lead_time_days);
    return nextDelivery;
  } else {
    // For fixed schedule mode, find next delivery day
    const schedule = deliverySchedules.find(s => s.supplier_id === supplier.id && s.is_active);
    if (!schedule) return null;
    
    const today = new Date();
    const currentDay = today.getDay();
    const deliveryDay = schedule.day_of_week;
    
    // Calculate days until next delivery
    let daysUntilDelivery = deliveryDay - currentDay;
    if (daysUntilDelivery <= 0) {
      daysUntilDelivery += 7; // Next week
    }
    
    const nextDelivery = new Date(today);
    nextDelivery.setDate(nextDelivery.getDate() + daysUntilDelivery);
    return nextDelivery;
  }
};

/**
 * Get next order date (when order must be placed)
 */
export const getNextOrderDate = (
  supplier: Supplier,
  deliverySchedules: any[]
): Date | null => {
  if (supplier.scheduling_mode === 'lead_time') {
    // For lead time mode, order date is today
    return new Date();
  } else {
    // For fixed schedule mode, find order day
    const schedule = deliverySchedules.find(s => s.supplier_id === supplier.id && s.is_active);
    if (!schedule) return null;
    
    const today = new Date();
    const currentDay = today.getDay();
    const orderDay = schedule.order_day_of_week;
    
    // Calculate days until next order day
    let daysUntilOrder = orderDay - currentDay;
    if (daysUntilOrder < 0) {
      daysUntilOrder += 7; // Next week
    }
    
    const nextOrder = new Date(today);
    nextOrder.setDate(nextOrder.getDate() + daysUntilOrder);
    return nextOrder;
  }
};

/**
 * Calculate days between now and next delivery
 */
export const getDaysUntilNextDelivery = (nextDeliveryDate: Date | null): number => {
  if (!nextDeliveryDate) return 7; // Default to 1 week
  
  const today = new Date();
  const diffTime = nextDeliveryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(1, diffDays);
};

/**
 * Check if ingredient needs reordering based on stockout prediction
 */
export const needsReorder = (
  ingredient: Ingredient,
  avgDailyUsage: number,
  daysUntilNextDelivery: number,
  lowStockThresholdDays: number = 3
): boolean => {
  const daysUntilStockout = calculateDaysUntilStockout(ingredient, avgDailyUsage);
  
  if (daysUntilStockout === null) {
    // No usage data, check against minimum stock (default to 0)
    return (ingredient.stock_level || 0) <= 0;
  }
  
  // Reorder if we'll run out before next delivery + threshold
  return daysUntilStockout <= (daysUntilNextDelivery + lowStockThresholdDays);
};