-- Update handle_new_customer to create customers immediately on reservation booking
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

  -- CASE 1: INSERT (any status) - Create customer immediately
  IF TG_OP = 'INSERT' THEN
    IF existing_customer_id IS NOT NULL THEN
      -- Update existing customer (don't change visit count yet)
      UPDATE public.customers
      SET 
        name = COALESCE(NEW.customer_name, name),
        email = COALESCE(NEW.email, email),
        phone = COALESCE(normalized_phone, phone),
        last_visit = GREATEST(COALESCE(last_visit, NEW.date), NEW.date)
      WHERE id = existing_customer_id;
    ELSE
      -- Create new customer with 0 visits (will increment on completion)
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
        0,
        NEW.date
      );
    END IF;
  END IF;

  -- CASE 2: UPDATE to 'completed' - Recalculate visit count
  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
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
      -- Update visit count on completion
      UPDATE public.customers
      SET 
        visits = calculated_visits,
        last_visit = GREATEST(COALESCE(last_visit, NEW.date), NEW.date)
      WHERE id = existing_customer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;