-- Add allergens column to menu_item_ingredients
ALTER TABLE public.menu_item_ingredients 
ADD COLUMN allergens TEXT[] DEFAULT '{}';

-- Create index for allergen queries
CREATE INDEX idx_menu_item_ingredients_allergens 
ON public.menu_item_ingredients USING GIN(allergens);

-- Add comment
COMMENT ON COLUMN public.menu_item_ingredients.allergens IS 'Array of allergen names from EU allergen list';