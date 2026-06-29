-- Add inventory tracking columns to ingredients table
ALTER TABLE ingredients
ADD COLUMN IF NOT EXISTS stock_level numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_unit text DEFAULT 'kg',
ADD COLUMN IF NOT EXISTS last_stock_update timestamp with time zone DEFAULT now();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_ingredients_stock_level ON ingredients(stock_level);

-- Add comments for documentation
COMMENT ON COLUMN ingredients.stock_level IS 'Current stock quantity in stock_unit';
COMMENT ON COLUMN ingredients.stock_unit IS 'Unit of measurement for stock (must be compatible with purchase_type)';
COMMENT ON COLUMN ingredients.last_stock_update IS 'Timestamp of last stock level change';

-- Set default stock values for existing ingredients
UPDATE ingredients 
SET 
  stock_level = 0,
  stock_unit = COALESCE(purchase_type, 'kg'),
  last_stock_update = now()
WHERE stock_level IS NULL;