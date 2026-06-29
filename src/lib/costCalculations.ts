import { convertToBaseUnit, areUnitsCompatible, getUnitSystem } from './unitConversions';

export interface CostCalculationInput {
  purchasePrice?: number | null;
  purchaseSize?: number | null;
  purchaseType?: string | null;
  portionSize?: number | null;
  portionType?: string | null;
  unitsPerPurchase?: number | null;
}

export const calculateCostPerPortion = (input: CostCalculationInput): number | null => {
  // Missing required data
  if (!input.purchasePrice || !input.purchaseSize || !input.portionSize) {
    return null;
  }
  
  if (!input.purchaseType || !input.portionType) {
    return null;
  }

  const purchaseSystem = getUnitSystem(input.purchaseType);
  const portionSystem = getUnitSystem(input.portionType);

  // Case 1: Beverage units (pint, barrel, bottle, etc.) - flexible, user-defined
  if (purchaseSystem === 'beverage' || portionSystem === 'beverage') {
    // Same beverage unit (e.g., pint to pint, barrel to barrel)
    if (input.purchaseType === input.portionType) {
      const portionsPerPurchase = input.purchaseSize / input.portionSize;
      return input.purchasePrice / portionsPerPurchase;
    }
    // Different beverage units (e.g., pint portions from barrel purchase) require units_per_purchase
    if (input.unitsPerPurchase) {
      return input.purchasePrice / input.unitsPerPurchase;
    }
    return null;
  }

  // Case 2: Individual to Individual with units_per_purchase
  if (input.portionType === 'Individual' && input.purchaseType !== 'Individual' && input.unitsPerPurchase) {
    return input.purchasePrice / input.unitsPerPurchase;
  }

  // Case 3: Same unit systems (weight/volume) with fixed conversions
  if (areUnitsCompatible(input.purchaseType, input.portionType)) {
    const purchaseInBaseUnit = convertToBaseUnit(input.purchaseSize, input.purchaseType);
    const portionInBaseUnit = convertToBaseUnit(input.portionSize, input.portionType);
    const portionsPerPurchase = purchaseInBaseUnit / portionInBaseUnit;
    return input.purchasePrice / portionsPerPurchase;
  }

  return null;
};

export const formatCostDisplay = (cost: number | null): string => {
  if (cost === null) return '—';
  return `£${cost.toFixed(4)}`;
};
