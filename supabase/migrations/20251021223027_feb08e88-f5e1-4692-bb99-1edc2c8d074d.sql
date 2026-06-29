-- Add kitchen_status column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS kitchen_status text DEFAULT 'pending' CHECK (kitchen_status IN ('pending', 'sent', 'preparing', 'ready', 'served'));

-- Add index for better query performance
CREATE INDEX idx_orders_kitchen_status ON orders(kitchen_status);

-- Add sent_to_kitchen_at timestamp for tracking
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS sent_to_kitchen_at timestamp with time zone;