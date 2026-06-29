// Master ingredient library
export interface Ingredient {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  sale_price: number;
  cost_price: number | null;
  portion_size: number;
  portion_type: string;
  supplier: string | null;
  supplier_id: string | null;
  purchase_size: number | null;
  purchase_type: string | null;
  purchase_price: number | null;
  is_active: boolean;
  allergens: string[];
  stock_level?: number;
  stock_unit?: string;
  last_stock_update?: string;
  known_as?: string | null;
  units_per_purchase?: number | null;
  created_at: string;
  updated_at: string;
}

// Portion type options
export const PORTION_TYPES = [
  'Individual',
  'g',
  'kg',
  'ml',
  'l',
  'oz',
  'lb',
  'cup',
  'tbsp',
  'tsp',
  'pint',
  'half-pint',
  'bottle',
  'case',
  'barrel',
  'keg',
  'can',
] as const;

export type PortionType = typeof PORTION_TYPES[number];

// Menu item ingredient (for menu item modifiers)
export interface MenuItemIngredient {
  id: string;
  menu_item_id: string;
  company_id: string;
  ingredient_name: string;
  is_included: boolean;
  add_on_cost: number;
  display_order: number;
  quantity: number;
  allergens?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface IngredientModification {
  ingredient_id: string;
  ingredient_name: string;
  modification_type: 'removed' | 'extra';
  quantity: number; // For extras (1, 2, 3, etc.)
  cost_per_unit: number;
}
