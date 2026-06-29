-- Add allergens column to menu_items table
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS allergens TEXT[] DEFAULT NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.menu_items.allergens IS 'Array of allergen names that this menu item contains';