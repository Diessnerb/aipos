-- Add notes column to order_items table
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN order_items.notes IS 'Special instructions or notes for this item';