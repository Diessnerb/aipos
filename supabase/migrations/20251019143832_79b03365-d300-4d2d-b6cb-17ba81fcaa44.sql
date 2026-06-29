-- Add missing fields to orders table for POS functionality
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS order_number INTEGER,
ADD COLUMN IF NOT EXISTS assignment_type TEXT CHECK (assignment_type IN ('table', 'customer_name'));

-- Create function to get next order number
CREATE OR REPLACE FUNCTION get_next_order_number(p_company_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_number INTEGER;
BEGIN
  -- Get the max order number for this company and add 1
  SELECT COALESCE(MAX(order_number), 0) + 1
  INTO v_next_number
  FROM orders
  WHERE company_id = p_company_id;
  
  RETURN v_next_number;
END;
$$;

-- Update status check to include all existing statuses plus new POS statuses
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'in_progress', 'completed', 'cancelled', 'paid', 'unpaid'));

-- Add index for faster queries on orders by status
CREATE INDEX IF NOT EXISTS idx_orders_status_company ON orders(company_id, status);