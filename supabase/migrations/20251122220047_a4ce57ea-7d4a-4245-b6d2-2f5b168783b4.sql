-- Update the trigger function to calculate minutes late
CREATE OR REPLACE FUNCTION track_reservation_late_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scheduled_time TIMESTAMPTZ;
  v_minutes_late INTEGER;
BEGIN
  -- Track when reservation status changes TO 'late'
  IF NEW.status = 'late' AND (OLD.status IS NULL OR OLD.status != 'late') THEN
    -- Calculate scheduled time by combining date and time
    v_scheduled_time := (NEW.date || ' ' || NEW.time)::TIMESTAMPTZ;
    
    -- Calculate minutes late if seated_at is available
    IF NEW.seated_at IS NOT NULL THEN
      v_minutes_late := ROUND(EXTRACT(EPOCH FROM (NEW.seated_at - v_scheduled_time)) / 60);
      -- Ensure it's positive (actually late, not early)
      IF v_minutes_late < 0 THEN
        v_minutes_late := 0;
      END IF;
    END IF;
    
    INSERT INTO customer_reservation_history (
      company_id,
      customer_name,
      customer_email,
      customer_phone,
      reservation_id,
      event_type,
      scheduled_time,
      reservation_date,
      party_size,
      minutes_late
    ) VALUES (
      NEW.company_id,
      NEW.customer_name,
      NEW.email,
      NEW.phone,
      NEW.id,
      'marked_late',
      NEW.time,
      NEW.date,
      NEW.party_size,
      v_minutes_late
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Backfill minutes_late for existing late arrival records that have NULL values
UPDATE customer_reservation_history h
SET minutes_late = ROUND(EXTRACT(EPOCH FROM (
  r.seated_at - (r.date || ' ' || r.time)::TIMESTAMPTZ
)) / 60)
FROM reservations r
WHERE h.reservation_id = r.id
  AND h.event_type IN ('marked_late', 'late_arrival')
  AND h.minutes_late IS NULL
  AND r.seated_at IS NOT NULL
  AND EXTRACT(EPOCH FROM (r.seated_at - (r.date || ' ' || r.time)::TIMESTAMPTZ)) / 60 > 0;