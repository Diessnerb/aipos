-- Track when reservation status changes TO 'late'
CREATE OR REPLACE FUNCTION track_reservation_late_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Track when reservation status changes TO 'late'
  IF NEW.status = 'late' AND (OLD.status IS NULL OR OLD.status != 'late') THEN
    INSERT INTO customer_reservation_history (
      company_id,
      customer_name,
      customer_email,
      customer_phone,
      reservation_id,
      event_type,
      scheduled_time,
      reservation_date,
      party_size
    ) VALUES (
      NEW.company_id,
      NEW.customer_name,
      NEW.email,
      NEW.phone,
      NEW.id,
      'marked_late',
      NEW.time,
      NEW.date,
      NEW.party_size
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_late_status_trigger ON reservations;
CREATE TRIGGER track_late_status_trigger
AFTER INSERT OR UPDATE OF status ON reservations
FOR EACH ROW
EXECUTE FUNCTION track_reservation_late_status();

-- Backfill existing 'late' and 'no-show' reservations into history table
INSERT INTO customer_reservation_history (
  company_id,
  customer_name,
  customer_email,
  customer_phone,
  reservation_id,
  event_type,
  reservation_date,
  party_size
)
SELECT 
  r.company_id,
  r.customer_name,
  r.email,
  r.phone,
  r.id,
  CASE 
    WHEN r.status = 'late' THEN 'marked_late'
    WHEN r.status = 'no-show' THEN 'no_show'
  END as event_type,
  r.date,
  r.party_size
FROM reservations r
WHERE r.status IN ('late', 'no-show')
ON CONFLICT DO NOTHING;