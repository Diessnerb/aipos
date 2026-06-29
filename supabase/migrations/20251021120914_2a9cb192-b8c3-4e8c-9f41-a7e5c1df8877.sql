-- Add quantity column to menu_item_ingredients
ALTER TABLE public.menu_item_ingredients 
ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;

-- Add constraint to ensure positive quantity
ALTER TABLE public.menu_item_ingredients
ADD CONSTRAINT check_quantity_positive CHECK (quantity > 0);

-- Add comment
COMMENT ON COLUMN public.menu_item_ingredients.quantity IS 'Standard quantity of this ingredient in the menu item (e.g., 2 for "2x Bacon")';