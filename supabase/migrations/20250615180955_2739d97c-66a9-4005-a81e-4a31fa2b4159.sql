
-- Update the holiday deduction function to allow negative balances
CREATE OR REPLACE FUNCTION public.deduct_holiday_days_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  days_requested integer;
BEGIN
  -- Only run on status update to Approved, and only transition from NOT Approved to Approved
  IF NEW.status = 'Approved' AND OLD.status IS DISTINCT FROM NEW.status AND OLD.status IS DISTINCT FROM 'Approved' THEN
    IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
      days_requested := (NEW.end_date - NEW.start_date) + 1;
      IF days_requested > 0 THEN
        -- Remove GREATEST constraint to allow negative balances
        UPDATE public.users
        SET remaining_holiday_days = remaining_holiday_days - days_requested
        WHERE id = NEW.user_id;

        -- Log deduction for audit/debugging
        INSERT INTO public.holiday_deduction_log(holiday_request_id, user_id, deducted_days)
        VALUES (NEW.id, NEW.user_id, days_requested);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
