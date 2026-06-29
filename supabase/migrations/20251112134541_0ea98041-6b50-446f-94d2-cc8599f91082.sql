-- Function to calculate and update customer total spent
CREATE OR REPLACE FUNCTION calculate_customer_total_spent(customer_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
  total NUMERIC;
BEGIN
  -- Sum all paid amounts from orders for this customer
  SELECT COALESCE(SUM(amount_paid), 0)
  INTO total
  FROM orders
  WHERE customer_id = customer_uuid
    AND payment_status = 'paid';
  
  -- Update customer record
  UPDATE customers
  SET total_spent = total
  WHERE id = customer_uuid;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-update customer total_spent when orders are paid
CREATE OR REPLACE FUNCTION trigger_update_customer_total_spent()
RETURNS TRIGGER AS $$
BEGIN
  -- If order is being marked as paid or amount_paid changes
  IF (TG_OP = 'UPDATE' AND NEW.customer_id IS NOT NULL) THEN
    -- If payment status changed to paid or amount_paid increased
    IF (NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid')) OR
       (NEW.amount_paid != OLD.amount_paid) THEN
      PERFORM calculate_customer_total_spent(NEW.customer_id);
    END IF;
  -- If order is being inserted and already paid
  ELSIF (TG_OP = 'INSERT' AND NEW.customer_id IS NOT NULL AND NEW.payment_status = 'paid') THEN
    PERFORM calculate_customer_total_spent(NEW.customer_id);
  -- If order is deleted
  ELSIF (TG_OP = 'DELETE' AND OLD.customer_id IS NOT NULL) THEN
    PERFORM calculate_customer_total_spent(OLD.customer_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_customer_total_spent_trigger ON orders;
CREATE TRIGGER update_customer_total_spent_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION trigger_update_customer_total_spent();

-- Function to auto-link orders to customers
CREATE OR REPLACE FUNCTION auto_link_order_to_customer()
RETURNS TRIGGER AS $$
DECLARE
  found_customer_id UUID;
BEGIN
  -- Only try to link if order doesn't already have a customer_id
  IF NEW.customer_id IS NULL AND NEW.company_id IS NOT NULL THEN
    -- If we have a customer_name, try matching by name
    IF NEW.customer_name IS NOT NULL THEN
      SELECT id INTO found_customer_id
      FROM customers
      WHERE company_id = NEW.company_id
        AND LOWER(TRIM(name)) = LOWER(TRIM(NEW.customer_name))
      LIMIT 1;
      
      IF found_customer_id IS NOT NULL THEN
        NEW.customer_id := found_customer_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_link_order_to_customer_trigger ON orders;
CREATE TRIGGER auto_link_order_to_customer_trigger
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION auto_link_order_to_customer();

-- Backfill: Link existing orders to customers by name match
UPDATE orders o
SET customer_id = (
  SELECT c.id
  FROM customers c
  WHERE c.company_id = o.company_id
    AND LOWER(TRIM(c.name)) = LOWER(TRIM(o.customer_name))
  LIMIT 1
)
WHERE o.customer_name IS NOT NULL
  AND o.customer_id IS NULL
  AND o.company_id IS NOT NULL;

-- Backfill existing customer totals (only for customers with company_id)
DO $$
DECLARE
  customer_record RECORD;
BEGIN
  FOR customer_record IN 
    SELECT DISTINCT id FROM customers WHERE company_id IS NOT NULL
  LOOP
    PERFORM calculate_customer_total_spent(customer_record.id);
  END LOOP;
END $$;