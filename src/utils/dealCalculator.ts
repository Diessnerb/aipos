import { BasketItem } from '@/contexts/OrderBasketContext';
import { Deal } from '@/hooks/useDeals';

export interface AppliedDeal {
  dealId: string;
  dealName: string;
  discountAmount: number;
  affectedItemIds: string[];
}

export interface DealCalculationResult {
  totalDiscount: number;
  appliedDeals: AppliedDeal[];
}

/**
 * Filters deals to only those active for the current day and time
 */
export const getActiveDeals = (allDeals: Deal[], currentDateTime: Date = new Date()): Deal[] => {
  const currentDay = currentDateTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTimeStr = currentDateTime.toTimeString().slice(0, 5); // "HH:MM"
  
  return allDeals.filter(deal => {
    // Check if deal is active
    if (!deal.is_active) return false;
    
    // Check if current day is in the deal's day_of_week array
    if (!deal.day_of_week.includes(currentDay)) return false;
    
    // Check if current time is within deal's time range
    if (currentTimeStr < deal.start_time || currentTimeStr > deal.end_time) return false;
    
    return true;
  });
};

/**
 * Matches basket items to a specific deal based on deal's applies_to rules
 */
const matchItemsToDeal = (basketItems: BasketItem[], deal: Deal): BasketItem[] => {
  if (!deal.applies_to || deal.applies_to === 'all') {
    return basketItems;
  }
  
  if (deal.applies_to === 'categories') {
    const categoryIds = deal.menu_category_ids || [];
    return basketItems.filter(item => 
      item.menuItem?.category_id && categoryIds.includes(item.menuItem.category_id)
    );
  }
  
  if (deal.applies_to === 'items') {
    const itemIds = deal.menu_item_ids || [];
    return basketItems.filter(item => 
      item.menuItem?.id && itemIds.includes(item.menuItem.id)
    );
  }
  
  return [];
};

/**
 * Calculates discount for a specific deal type
 */
const calculateDealDiscount = (deal: Deal, qualifyingItems: BasketItem[]): { discount: number; affectedIds: string[] } => {
  if (qualifyingItems.length === 0) {
    return { discount: 0, affectedIds: [] };
  }
  
  const allAffectedIds = qualifyingItems.map(item => item.id);
  
  // N for M deals (e.g., 3 for 2 on tapas)
  if (deal.deal_type === 'n_for_m') {
    const n = deal.n_value || 3;
    const m = deal.m_value || 2;
    
    // Expand basket items by quantity to get individual items
    const expandedItems: Array<{ unitPrice: number; basketItemId: string }> = [];
    qualifyingItems.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        expandedItems.push({
          unitPrice: item.unitPrice,
          basketItemId: item.id
        });
      }
    });
    
    // Check total quantity instead of basket item count
    if (expandedItems.length < n) {
      return { discount: 0, affectedIds: [] };
    }
    
    // Sort expanded items by unit price (ascending) to discount the cheapest
    const sortedItems = [...expandedItems].sort((a, b) => a.unitPrice - b.unitPrice);
    
    // Calculate how many complete sets we have
    const completeSets = Math.floor(expandedItems.length / n);
    
    // For each complete set, discount (n - m) cheapest items
    const itemsToDiscount = completeSets * (n - m);
    const discount = sortedItems
      .slice(0, itemsToDiscount)
      .reduce((sum, item) => sum + item.unitPrice, 0);
    
    return { discount, affectedIds: allAffectedIds };
  }
  
  // Percentage off deals (e.g., 20% off)
  if (deal.deal_type === 'percentage_off') {
    const discountValue = deal.discount_value || 0;
    const totalPrice = qualifyingItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const discount = totalPrice * (discountValue / 100);
    
    return { discount, affectedIds: allAffectedIds };
  }
  
  // Amount off deals (e.g., £1 off)
  if (deal.deal_type === 'amount_off') {
    const discountValue = deal.discount_value || 0;
    const discount = Math.min(discountValue, qualifyingItems.reduce((sum, item) => sum + item.totalPrice, 0));
    
    return { discount, affectedIds: allAffectedIds };
  }
  
  return { discount: 0, affectedIds: [] };
};

/**
 * Main orchestration function to calculate all applicable deals
 */
export const calculateAllDeals = (
  basketItems: BasketItem[], 
  allDeals: Deal[],
  currentDateTime?: Date
): DealCalculationResult => {
  if (!basketItems.length || !allDeals.length) {
    return { totalDiscount: 0, appliedDeals: [] };
  }
  
  // Filter to only active deals
  const activeDeals = getActiveDeals(allDeals, currentDateTime);
  
  if (activeDeals.length === 0) {
    return { totalDiscount: 0, appliedDeals: [] };
  }
  
  // Calculate discount for each active deal
  const dealResults: AppliedDeal[] = [];
  
  for (const deal of activeDeals) {
    const qualifyingItems = matchItemsToDeal(basketItems, deal);
    const { discount, affectedIds } = calculateDealDiscount(deal, qualifyingItems);
    
    if (discount > 0) {
      dealResults.push({
        dealId: deal.id,
        dealName: deal.deal_name,
        discountAmount: discount,
        affectedItemIds: affectedIds,
      });
    }
  }
  
  // For now, apply all deals (stacking)
  // Future: Could implement "best single deal" strategy instead
  const totalDiscount = dealResults.reduce((sum, deal) => sum + deal.discountAmount, 0);
  
  return {
    totalDiscount,
    appliedDeals: dealResults,
  };
};
