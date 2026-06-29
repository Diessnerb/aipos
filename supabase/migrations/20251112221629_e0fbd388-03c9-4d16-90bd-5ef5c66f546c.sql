-- Function to update customer counts from history table
CREATE OR REPLACE FUNCTION update_customer_counts_from_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the customer's late_count and no_show_count
  UPDATE customers
  SET 
    late_count = (
      SELECT COUNT(*)
      FROM customer_reservation_history
      WHERE customer_phone = NEW.customer_phone
        AND company_id = NEW.company_id
        AND event_type IN ('marked_late', 'late_arrival')
    ),
    no_show_count = (
      SELECT COUNT(*)
      FROM customer_reservation_history
      WHERE customer_phone = NEW.customer_phone
        AND company_id = NEW.company_id
        AND event_type = 'no_show'
    )
  WHERE phone = NEW.customer_phone
    AND company_id = NEW.company_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger on customer_reservation_history
DROP TRIGGER IF EXISTS sync_customer_counts_trigger ON customer_reservation_history;
CREATE TRIGGER sync_customer_counts_trigger
AFTER INSERT ON customer_reservation_history
FOR EACH ROW
EXECUTE FUNCTION update_customer_counts_from_history();

-- One-time recalculation of all customer counts from history (only for customers with valid company_id)
UPDATE customers c
SET 
  late_count = (
    SELECT COUNT(*)
    FROM customer_reservation_history h
    WHERE h.customer_phone = c.phone
      AND h.company_id = c.company_id
      AND h.event_type IN ('marked_late', 'late_arrival')
  ),
  no_show_count = (
    SELECT COUNT(*)
    FROM customer_reservation_history h
    WHERE h.customer_phone = c.phone
      AND h.company_id = c.company_id
      AND h.event_type = 'no_show'
  )
WHERE c.company_id IS NOT NULL;