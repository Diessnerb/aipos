export const WEIGHT_UNITS = ['g', 'kg', 'oz', 'lb'] as const;
export const VOLUME_UNITS = ['ml', 'l', 'cup', 'tbsp', 'tsp'] as const;
export const BEVERAGE_UNITS = ['pint', 'half-pint', 'bottle', 'case', 'barrel', 'keg', 'can'] as const;
export const INDIVIDUAL_UNIT = 'Individual' as const;

export type WeightUnit = typeof WEIGHT_UNITS[number];
export type VolumeUnit = typeof VOLUME_UNITS[number];
export type BeverageUnit = typeof BEVERAGE_UNITS[number];
export type MeasurementUnit = WeightUnit | VolumeUnit | BeverageUnit | typeof INDIVIDUAL_UNIT;

export const areUnitsCompatible = (unit1: string, unit2: string): boolean => {
  // Individual must match Individual only
  if (unit1 === INDIVIDUAL_UNIT || unit2 === INDIVIDUAL_UNIT) {
    return unit1 === unit2;
  }
  
  // Beverage units must match exactly (no conversion between pint/barrel/bottle)
  const isBeverage1 = BEVERAGE_UNITS.includes(unit1 as BeverageUnit);
  const isBeverage2 = BEVERAGE_UNITS.includes(unit2 as BeverageUnit);
  if (isBeverage1 || isBeverage2) {
    return unit1 === unit2;
  }
  
  // Weight units must match weight units
  const isWeight1 = WEIGHT_UNITS.includes(unit1 as WeightUnit);
  const isWeight2 = WEIGHT_UNITS.includes(unit2 as WeightUnit);
  
  // Volume units must match volume units
  const isVolume1 = VOLUME_UNITS.includes(unit1 as VolumeUnit);
  const isVolume2 = VOLUME_UNITS.includes(unit2 as VolumeUnit);
  
  return (isWeight1 && isWeight2) || (isVolume1 && isVolume2);
};

export const getUnitSystem = (unit: string): 'weight' | 'volume' | 'beverage' | 'individual' | 'unknown' => {
  if (unit === INDIVIDUAL_UNIT) return 'individual';
  if (BEVERAGE_UNITS.includes(unit as BeverageUnit)) return 'beverage';
  if (WEIGHT_UNITS.includes(unit as WeightUnit)) return 'weight';
  if (VOLUME_UNITS.includes(unit as VolumeUnit)) return 'volume';
  return 'unknown';
};

export const convertToBaseUnit = (value: number, unit: string): number => {
  const conversions: Record<string, number> = {
    // Weight to grams
    'g': 1,
    'kg': 1000,
    'oz': 28.3495,
    'lb': 453.592,
    // Volume to milliliters
    'ml': 1,
    'l': 1000,
    'cup': 236.588,
    'tbsp': 14.7868,
    'tsp': 4.92892
  };
  
  return value * (conversions[unit] || 1);
};

export const calculateAvailablePortions = (
  stockLevel: number,
  stockUnit: string,
  portionSize: number,
  portionUnit: string
): number => {
  // For Individual units, simple division
  if (stockUnit === INDIVIDUAL_UNIT && portionUnit === INDIVIDUAL_UNIT) {
    return Math.floor(stockLevel / portionSize);
  }
  
  if (!areUnitsCompatible(stockUnit, portionUnit)) {
    console.error('Incompatible units: cannot calculate portions');
    return 0;
  }
  
  const stockInBaseUnit = convertToBaseUnit(stockLevel, stockUnit);
  const portionInBaseUnit = convertToBaseUnit(portionSize, portionUnit);
  
  return Math.floor(stockInBaseUnit / portionInBaseUnit);
};

export const formatStockDisplay = (value: number, unit: string): string => {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} ${unit}`;
};
