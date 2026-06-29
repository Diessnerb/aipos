-- Update the handle_new_customer function to properly handle existing customers
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  existing_customer_id uuid;
BEGIN
  -- First check if customer exists by phone number (primary identifier)
  SELECT id INTO existing_customer_id
  FROM customers 
  WHERE phone = NEW.phone AND phone IS NOT NULL AND phone != '';

  -- If no match by phone, check by email as fallback
  IF existing_customer_id IS NULL AND NEW.email IS NOT NULL AND NEW.email != '' THEN
    SELECT id INTO existing_customer_id
    FROM customers 
    WHERE email = NEW.email;
  END IF;

  IF existing_customer_id IS NOT NULL THEN
    -- Customer exists, update their visit count and last visit date
    UPDATE customers 
    SET 
      visits = COALESCE(visits, 0) + 1,
      last_visit = NEW.date,
      -- Update name if it was empty or if new name is more complete
      name = CASE 
        WHEN name IS NULL OR name = '' OR char_length(NEW.customer_name) > char_length(name) 
        THEN NEW.customer_name 
        ELSE name 
      END,
      -- Update email if it was empty
      email = CASE 
        WHEN (email IS NULL OR email = '') AND NEW.email IS NOT NULL AND NEW.email != ''
        THEN NEW.email 
        ELSE email 
      END
    WHERE id = existing_customer_id;
  ELSE
    -- Customer doesn't exist, create new record
    INSERT INTO customers (
      name, 
      email, 
      phone, 
      visits, 
      total_spent, 
      last_visit, 
      preferences, 
      notes, 
      vip_status, 
      do_not_contact
    )
    VALUES (
      NEW.customer_name,
      NEW.email,
      NEW.phone,
      1,                    -- initial visit count
      0.0,                  -- starting spend
      NEW.date,            -- first visit date
      array[]::text[],      -- empty preferences
      null,                 -- no notes initially
      false,                -- not VIP by default
      false                 -- allow contact by default
    );
  END IF;
  
  RETURN NEW;
END;
$function$;