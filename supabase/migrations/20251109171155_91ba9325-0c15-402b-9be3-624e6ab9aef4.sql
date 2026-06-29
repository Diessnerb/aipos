-- Add columns for unit relationships and friendly names
ALTER TABLE ingredients 
ADD COLUMN IF NOT EXISTS known_as text,
ADD COLUMN IF NOT EXISTS units_per_purchase numeric;

COMMENT ON COLUMN ingredients.known_as IS 'Friendly name for the purchase unit, e.g., "1 tin", "1 pack", "1 bag"';
COMMENT ON COLUMN ingredients.units_per_purchase IS 'How many individual portions come in one purchase unit, e.g., 25 rashers per 1kg pack';