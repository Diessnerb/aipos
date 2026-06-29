
-- Step 1: (optional, for diagnostics) Create a log table for deductions (optional, but helps troubleshooting)
CREATE TABLE IF NOT EXISTS public.holiday_deduction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_request_id uuid NOT NULL,
  user_id uuid NOT NULL,
  deducted_days integer NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now()
);

-- Step 2: Update the deduction function to detect double deductions, log events, and avoid duplicates

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
        UPDATE public.users
        SET remaining_holiday_days = GREATEST(remaining_holiday_days - days_requested, 0)
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

-- Step 3: (Re-)Attach the trigger to the holiday_requests table
DROP TRIGGER IF EXISTS trg_deduct_holiday_days_on_approval ON public.holiday_requests;

CREATE TRIGGER trg_deduct_holiday_days_on_approval
AFTER UPDATE OF status ON public.holiday_requests
FOR EACH ROW
EXECUTE FUNCTION public.deduct_holiday_days_on_approval();
