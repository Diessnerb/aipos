-- Fix handle_new_customer function to use correct column names from reservations table
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id UUID;
  v_normalized_phone TEXT;
BEGIN
  -- Only process if we have customer contact info
  IF NEW.phone IS NULL AND NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Normalize phone number (remove spaces, dashes, etc)
  IF NEW.phone IS NOT NULL THEN
    v_normalized_phone := regexp_replace(NEW.phone, '[^0-9+]', '', 'g');
  END IF;

  -- Try to find existing customer by email or normalized phone
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE company_id = NEW.company_id
    AND (
      (NEW.email IS NOT NULL AND email = NEW.email)
      OR (v_normalized_phone IS NOT NULL AND regexp_replace(phone, '[^0-9+]', '', 'g') = v_normalized_phone)
    )
  LIMIT 1;

  -- If customer doesn't exist, create them
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      company_id,
      name,
      email,
      phone
    ) VALUES (
      NEW.company_id,
      NEW.customer_name,
      NEW.email,
      NEW.phone
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_customer_id;
  ELSE
    -- Update existing customer with latest info
    UPDATE public.customers
    SET 
      name = COALESCE(NEW.customer_name, name),
      email = COALESCE(NEW.email, email),
      phone = COALESCE(NEW.phone, phone),
      last_visit = CURRENT_DATE
    WHERE id = v_customer_id;
  END IF;

  RETURN NEW;
END;
$function$;