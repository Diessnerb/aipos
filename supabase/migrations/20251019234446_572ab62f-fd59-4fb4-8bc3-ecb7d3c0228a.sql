-- Add amount_paid column to orders table for partial payment tracking
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0 NOT NULL;

-- Update existing paid orders to have amount_paid equal to total_amount
UPDATE orders 
SET amount_paid = total_amount 
WHERE status = 'paid' AND amount_paid = 0;

-- Add comment for documentation
COMMENT ON COLUMN orders.amount_paid IS 'Cumulative amount paid toward this order. Compare with total_amount to determine remaining balance.';