-- Phase 1: Fix Customer Visit Count Logic
-- Note: reservations table links to customers via customer_name, phone, and email fields

-- Create function to increment customer visit count when reservation is completed
CREATE OR REPLACE FUNCTION increment_customer_visit_count()
RETURNS TRIGGER AS $$
DECLARE
  matched_customer_id uuid;
BEGIN
  -- Only process if status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Find matching customer by name, phone, or email in same company
    SELECT id INTO matched_customer_id
    FROM customers
    WHERE company_id = NEW.company_id
      AND (
        (name = NEW.customer_name)
        OR (phone IS NOT NULL AND phone = NEW.phone)
        OR (email IS NOT NULL AND email = NEW.email)
      )
    LIMIT 1;
    
    -- Update visit count if customer found
    IF matched_customer_id IS NOT NULL THEN
      UPDATE customers
      SET 
        visits = COALESCE(visits, 0) + 1,
        last_visit = NEW.date
      WHERE id = matched_customer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on reservations table
DROP TRIGGER IF EXISTS on_reservation_completed ON reservations;
CREATE TRIGGER on_reservation_completed
  AFTER UPDATE ON reservations
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION increment_customer_visit_count();

-- Backfill existing customer visit counts from completed reservations
UPDATE customers c
SET visits = COALESCE((
  SELECT COUNT(DISTINCT r.id)
  FROM reservations r
  WHERE r.company_id = c.company_id
    AND r.status = 'completed'
    AND (
      r.customer_name = c.name
      OR (r.phone IS NOT NULL AND r.phone = c.phone)
      OR (r.email IS NOT NULL AND r.email = c.email)
    )
), 0),
last_visit = (
  SELECT MAX(r.date)
  FROM reservations r
  WHERE r.company_id = c.company_id
    AND r.status = 'completed'
    AND (
      r.customer_name = c.name
      OR (r.phone IS NOT NULL AND r.phone = c.phone)
      OR (r.email IS NOT NULL AND r.email = c.email)
    )
)
WHERE c.company_id IS NOT NULL;