import { MenuItem } from '@/types/menu';
import { ProductLink, ProductLinkTreeNode } from '@/types/productLinks';

export interface SelectedOptions {
  [level: number]: string; // level -> selected product link id
}

export interface PriceBreakdownItem {
  level: number;
  optionName: string;
  linkId: string;
  price: number;
  isModifier: boolean;
}

/**
 * Build a hierarchical tree structure from flat product links array
 * Only includes child levels when their parent is selected
 */
export const buildProductLinkTree = (
  productLinks: ProductLink[],
  selectedOptions: SelectedOptions = {}
): Map<number, ProductLink[]> => {
  const levelMap = new Map<number, ProductLink[]>();
  
  productLinks.forEach(link => {
    // Level 1 always shows all options
    if (link.level === 1) {
      if (!levelMap.has(1)) {
        levelMap.set(1, []);
      }
      levelMap.get(1)!.push(link);
      return;
    }
    
    // For levels 2+, only include if:
    // 1. No parent link (orphaned options - show independently)
    // 2. Parent is selected from previous level
    if (!link.parent_link_id) {
      // Orphaned option - show independently at its level
      if (!levelMap.has(link.level)) {
        levelMap.set(link.level, []);
      }
      levelMap.get(link.level)!.push(link);
    } else {
      // Has parent - check if parent is selected
      const parentLevel = link.level - 1;
      const selectedParentId = selectedOptions[parentLevel];
      
      if (selectedParentId === link.parent_link_id) {
        if (!levelMap.has(link.level)) {
          levelMap.set(link.level, []);
        }
        levelMap.get(link.level)!.push(link);
      }
    }
  });
  
  // Sort each level by display_order
  levelMap.forEach((links) => {
    links.sort((a, b) => a.display_order - b.display_order);
  });
  
  return levelMap;
};

/**
 * Determine pricing mode based on product links
 */
export const getPricingMode = (productLinks: ProductLink[]): 'base_price' | 'modifier' => {
  const level1Links = productLinks.filter(link => link.level === 1);
  return level1Links.some(link => link.base_price !== null) ? 'base_price' : 'modifier';
};

/**
 * Calculate total price based on selected options
 */
export const calculatePrice = (
  item: MenuItem,
  selectedOptions: SelectedOptions,
  productLinks: ProductLink[]
): number => {
  const pricingMode = getPricingMode(productLinks);
  
  if (pricingMode === 'base_price') {
    // In base_price mode, level 1 selection determines the base
    const level1Id = selectedOptions[1];
    if (!level1Id) return item.price || 0;
    
    const level1Link = productLinks.find(link => link.id === level1Id);
    let total = level1Link?.base_price ?? item.price ?? 0;
    
    // Add modifiers from other levels
    Object.entries(selectedOptions).forEach(([level, linkId]) => {
      if (parseInt(level) === 1) return; // Skip level 1, already counted
      const link = productLinks.find(l => l.id === linkId);
      if (link?.price_modifier) {
        total += link.price_modifier;
      }
    });
    
    return total;
  } else {
    // In modifier mode, start with item base price
    let total = item.price || 0;
    
    // Add all modifiers from selected options
    Object.values(selectedOptions).forEach(linkId => {
      const link = productLinks.find(l => l.id === linkId);
      if (link?.price_modifier) {
        total += link.price_modifier;
      }
    });
    
    return total;
  }
};

/**
 * Get price breakdown showing what contributes to the total
 */
export const getPriceBreakdown = (
  item: MenuItem,
  selectedOptions: SelectedOptions,
  productLinks: ProductLink[]
): PriceBreakdownItem[] => {
  const breakdown: PriceBreakdownItem[] = [];
  const pricingMode = getPricingMode(productLinks);
  
  if (pricingMode === 'base_price') {
    const level1Id = selectedOptions[1];
    if (level1Id) {
      const level1Link = productLinks.find(link => link.id === level1Id);
      if (level1Link) {
        breakdown.push({
          level: 1,
          optionName: level1Link.option_name,
          linkId: level1Link.id,
          price: level1Link.base_price ?? 0,
          isModifier: false
        });
      }
    }
    
    // Add modifiers from other levels
    Object.entries(selectedOptions).forEach(([level, linkId]) => {
      if (parseInt(level) === 1) return;
      const link = productLinks.find(l => l.id === linkId);
      if (link && link.price_modifier !== null) {
        breakdown.push({
          level: parseInt(level),
          optionName: link.option_name,
          linkId: link.id,
          price: link.price_modifier,
          isModifier: true
        });
      }
    });
  } else {
    // Modifier mode - show base price first
    if (item.price) {
      breakdown.push({
        level: 0,
        optionName: 'Base Price',
        linkId: '',
        price: item.price,
        isModifier: false
      });
    }
    
    // Add all modifiers
    Object.entries(selectedOptions).forEach(([level, linkId]) => {
      const link = productLinks.find(l => l.id === linkId);
      if (link && link.price_modifier !== null) {
        breakdown.push({
          level: parseInt(level),
          optionName: link.option_name,
          linkId: link.id,
          price: link.price_modifier,
          isModifier: true
        });
      }
    });
  }
  
  return breakdown;
};

/**
 * Get the price range for display (min to max)
 */
export const getPriceRange = (item: MenuItem, productLinks: ProductLink[]): { min: number; max: number } => {
  const level1Links = productLinks.filter(link => link.level === 1);
  
  if (level1Links.length === 0) {
    const basePrice = item.price || 0;
    return { min: basePrice, max: basePrice };
  }
  
  const pricingMode = getPricingMode(productLinks);
  
  if (pricingMode === 'base_price') {
    const prices = level1Links
      .filter(link => link.base_price !== null)
      .map(link => link.base_price!);
    
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  } else {
    const basePrice = item.price || 0;
    const modifiers = level1Links
      .filter(link => link.price_modifier !== null)
      .map(link => link.price_modifier!);
    
    if (modifiers.length === 0) {
      return { min: basePrice, max: basePrice };
    }
    
    return {
      min: basePrice + Math.min(...modifiers),
      max: basePrice + Math.max(...modifiers)
    };
  }
};
