-- Fix handle_new_customer() function to use correct column names from reservations table
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_customer_id uuid;
  normalized_phone text;
  current_visits integer;
BEGIN
  -- Skip if no customer name provided
  IF (NEW.customer_name IS NULL OR NEW.customer_name = '') THEN
    RETURN NEW;
  END IF;
  
  -- Skip if no contact info provided (use correct column names: phone and email)
  IF (NEW.phone IS NULL OR NEW.phone = '') AND (NEW.email IS NULL OR NEW.email = '') THEN
    RETURN NEW;
  END IF;
  
  -- Normalize phone using correct column name
  normalized_phone := normalize_uk_phone(NEW.phone);
  
  -- Try to find existing customer by normalized phone (primary match)
  IF normalized_phone IS NOT NULL AND normalized_phone != '' THEN
    SELECT id, COALESCE(visits, 0) INTO existing_customer_id, current_visits
    FROM customers 
    WHERE phone = normalized_phone 
      AND company_id = NEW.company_id
    LIMIT 1;
  END IF;
  
  -- Fallback to email match if no phone match found (use correct column name)
  IF existing_customer_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
    SELECT id, COALESCE(visits, 0) INTO existing_customer_id, current_visits
    FROM customers 
    WHERE email = NEW.email 
      AND company_id = NEW.company_id
    LIMIT 1;
  END IF;
  
  -- Update existing customer
  IF existing_customer_id IS NOT NULL THEN
    UPDATE customers SET
      -- DO NOT increment visits here - only increment when reservation status = 'completed'
      visits = visits,
      -- Update last visit to reservation date
      last_visit = NEW.date,
      -- Update name if new one is longer/better
      name = CASE 
        WHEN LENGTH(NEW.customer_name) > LENGTH(name) THEN NEW.customer_name
        ELSE name
      END,
      -- Update contact info if missing (use correct column names)
      email = COALESCE(email, NEW.email),
      phone = COALESCE(phone, normalized_phone)
    WHERE id = existing_customer_id;
  ELSE
    -- Create new customer record
    INSERT INTO customers (
      company_id,
      name,
      email,
      phone,
      visits,
      last_visit,
      vip_status,
      sms_opt_out,
      do_not_contact,
      late_count,
      no_show_count,
      average_minutes_late
    ) VALUES (
      NEW.company_id,
      NEW.customer_name,
      NEW.email,
      normalized_phone,
      0, -- Start at 0 visits, will increment when reservation is completed
      NEW.date,
      false,
      false,
      false,
      0,
      0,
      0
    );
  END IF;
  
  RETURN NEW;
END;
$$;