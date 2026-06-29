-- Add scheduled_for column to orders table for pre-orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- Create index for efficient querying of scheduled orders
CREATE INDEX idx_orders_scheduled_for ON orders(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN orders.scheduled_for IS 'Customer pickup/delivery time for pre-orders. Kitchen sees order 1hr before this time. NULL = prepare immediately';