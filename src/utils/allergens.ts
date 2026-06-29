// Standard allergen list based on EU regulations
export const ALLERGEN_LIST = [
  'Gluten',
  'Crustaceans', 
  'Eggs',
  'Fish',
  'Peanuts',
  'Soybeans',
  'Milk',
  'Nuts',
  'Celery',
  'Mustard',
  'Sesame',
  'Sulphites',
  'Lupin',
  'Molluscs'
];

// Helper functions for displaying allergen information
export const formatAllergenDisplay = (allergens: string[]): string => {
  if (!allergens || allergens.length === 0) return '';
  
  if (allergens.length === 1) {
    return allergens[0];
  } else if (allergens.length <= 3) {
    return allergens.join(', ');
  } else {
    return `${allergens.slice(0, 2).join(', ')}, +${allergens.length - 2} more`;
  }
};

export const getAllergenWarningText = (allergens: string[]): string => {
  if (!allergens || allergens.length === 0) return '';
  
  const count = allergens.length;
  if (count === 1) {
    return `⚠️ Allergy: ${allergens[0]}`;
  } else {
    return `⚠️ ${count} Allergies: ${formatAllergenDisplay(allergens)}`;
  }
};

/**
 * Calculate unique allergens from included ingredients only
 */
export const calculateMenuItemAllergens = (
  ingredients: Array<{ is_included: boolean; allergens?: string[] }>
): string[] => {
  if (!ingredients || ingredients.length === 0) return [];
  
  const allAllergens = ingredients
    .filter(ingredient => ingredient.is_included)
    .flatMap(ingredient => ingredient.allergens || []);
  
  return [...new Set(allAllergens)].sort();
};