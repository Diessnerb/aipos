
-- 1. Create a trigger function to deduct remaining holiday days when request is approved
CREATE OR REPLACE FUNCTION public.deduct_holiday_days_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  days_requested integer;
BEGIN
  -- Only run on update to Approved status, and only if status changed
  IF NEW.status = 'Approved' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
      days_requested := (NEW.end_date - NEW.start_date) + 1;
      -- Only deduct if days_requested > 0
      IF days_requested > 0 THEN
        UPDATE public.users
        SET remaining_holiday_days = GREATEST(remaining_holiday_days - days_requested, 0)
        WHERE id = NEW.user_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach the trigger to the holiday_requests table
DROP TRIGGER IF EXISTS trg_deduct_holiday_days_on_approval ON public.holiday_requests;

CREATE TRIGGER trg_deduct_holiday_days_on_approval
AFTER UPDATE OF status ON public.holiday_requests
FOR EACH ROW
EXECUTE FUNCTION public.deduct_holiday_days_on_approval();
