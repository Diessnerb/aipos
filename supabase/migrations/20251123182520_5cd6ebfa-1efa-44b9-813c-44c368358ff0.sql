-- Enable decimal quantities for menu item ingredients
-- Change quantity from integer to numeric to support values like 0.5, 1.25, 12.5

ALTER TABLE menu_item_ingredients 
ALTER COLUMN quantity TYPE numeric(10, 2) USING quantity::numeric;

ALTER TABLE menu_item_ingredients 
ALTER COLUMN quantity SET DEFAULT 1;

-- Add constraint to ensure quantity is always positive
ALTER TABLE menu_item_ingredients 
ADD CONSTRAINT quantity_positive CHECK (quantity > 0);

-- Add helpful comment
COMMENT ON COLUMN menu_item_ingredients.quantity IS 'Quantity of ingredient used (supports decimals, e.g., 0.5, 1.25, 12.5). Max precision: 2 decimal places.';