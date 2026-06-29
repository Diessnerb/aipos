import { MenuItem } from '@/types/menu';
import { ProductLink } from '@/types/productLinks';

export const formatMenuItemPrice = (
  item: MenuItem,
  productLinks: ProductLink[] = [],
  formatCurrency: (value: number) => string = (value) => `£${value.toFixed(2)}`,
  showAddOnsText: boolean = true
): string => {
  const level1Links = productLinks.filter(link => link.level === 1);
  const hasProductLinks = level1Links && level1Links.length > 0;

  if (!hasProductLinks) {
    // Simple static price
    return formatCurrency(item.price || 0);
  }

  // Calculate price range from product links
  const prices = level1Links
    .map(link => {
      if (link.base_price !== null) {
        return link.base_price;
      }
      if (link.price_modifier !== null && item.price) {
        return item.price + link.price_modifier;
      }
      return item.price || 0;
    });
  // REMOVED: .filter(p => p > 0) - we want to include £0 prices in the range

  if (prices.length === 0) {
    return formatCurrency(item.price || 0);
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (minPrice === maxPrice) {
    return formatCurrency(minPrice);
  }

  // Check pricing mode
  const isBasePriceMode = level1Links.some(link => link.base_price !== null);
  
  if (isBasePriceMode) {
    return `${formatCurrency(minPrice)} to ${formatCurrency(maxPrice)}`;
  } else {
    if (showAddOnsText) {
      return `${formatCurrency(item.price || 0)} (+ Add-ons)`;
    } else {
      return formatCurrency(item.price || 0);
    }
  }
};
