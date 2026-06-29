import { MenuItemIngredient } from '@/types/ingredients';

/**
 * Format ingredient name with quantity prefix
 * @param ingredient - The ingredient object
 * @returns Formatted string (e.g., "2× Bacon" or "Bacon" if qty=1)
 */
export const formatIngredientDisplay = (ingredient: MenuItemIngredient): string => {
  if (ingredient.quantity > 1) {
    return `${ingredient.quantity}× ${ingredient.ingredient_name}`;
  }
  return ingredient.ingredient_name;
};

/**
 * Format ingredient with quantity in parentheses
 * @param ingredient - The ingredient object
 * @returns Formatted string (e.g., "Bacon (×2)" or "Bacon" if qty=1)
 */
export const formatIngredientWithParens = (ingredient: MenuItemIngredient): string => {
  if (ingredient.quantity > 1) {
    return `${ingredient.ingredient_name} (×${ingredient.quantity})`;
  }
  return ingredient.ingredient_name;
}
