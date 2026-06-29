-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_new_customer ON public.reservations;

-- Replace handle_new_customer function with corrected version
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_phone TEXT;
  existing_customer_id UUID;
  calculated_visits INTEGER;
BEGIN
  -- Only process for completed reservations or when transitioning to completed
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) THEN
    
    -- Normalize phone number
    IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
      normalized_phone := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
      IF length(normalized_phone) = 10 THEN
        normalized_phone := '0' || normalized_phone;
      END IF;
    END IF;

    -- Try to find existing customer by phone or email
    SELECT id INTO existing_customer_id
    FROM public.customers
    WHERE company_id = NEW.company_id
      AND (
        (normalized_phone IS NOT NULL AND normalized_phone != '' AND phone = normalized_phone)
        OR
        (NEW.email IS NOT NULL AND NEW.email != '' AND email = NEW.email)
      )
    LIMIT 1;

    -- Calculate accurate visit count from completed reservations
    SELECT COALESCE(COUNT(*), 0) INTO calculated_visits
    FROM public.reservations r
    WHERE r.company_id = NEW.company_id
      AND r.status = 'completed'
      AND (
        (normalized_phone IS NOT NULL AND normalized_phone != '' AND r.phone = normalized_phone)
        OR
        (NEW.email IS NOT NULL AND NEW.email != '' AND r.email = NEW.email)
      );

    IF existing_customer_id IS NOT NULL THEN
      -- Update existing customer with calculated visits
      UPDATE public.customers
      SET 
        name = COALESCE(NEW.customer_name, name),
        email = COALESCE(NEW.email, email),
        phone = COALESCE(normalized_phone, phone),
        visits = calculated_visits,
        last_visit = GREATEST(COALESCE(last_visit, NEW.date), NEW.date)
      WHERE id = existing_customer_id;
    ELSE
      -- Create new customer with calculated visits
      INSERT INTO public.customers (
        company_id,
        name,
        email,
        phone,
        visits,
        last_visit
      ) VALUES (
        NEW.company_id,
        NEW.customer_name,
        NEW.email,
        normalized_phone,
        calculated_visits,
        NEW.date
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER trigger_new_customer
  AFTER INSERT OR UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_customer();

-- Backfill: Recalculate visit counts for existing customers with valid company_id
UPDATE public.customers c
SET visits = (
  SELECT COALESCE(COUNT(*), 0)
  FROM public.reservations r
  WHERE r.company_id = c.company_id
    AND r.status = 'completed'
    AND (
      (c.phone IS NOT NULL AND c.phone != '' AND r.phone = c.phone)
      OR
      (c.email IS NOT NULL AND c.email != '' AND r.email = c.email)
    )
)
WHERE c.company_id IS NOT NULL;