-- Normalize phone numbers across all tables to 11-digit UK format with no spaces

-- Function to normalize UK phone numbers
CREATE OR REPLACE FUNCTION normalize_uk_phone(phone_input text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  digits text;
  normalized_phone text;
BEGIN
  -- Return empty string if input is null or empty
  IF phone_input IS NULL OR trim(phone_input) = '' THEN
    RETURN '';
  END IF;
  
  -- Remove all non-digit characters
  digits := regexp_replace(phone_input, '[^0-9]', '', 'g');
  
  -- Handle different UK phone number formats
  IF length(digits) = 11 AND (digits ~ '^07' OR digits ~ '^01' OR digits ~ '^02') THEN
    -- Already in correct 11-digit format
    RETURN digits;
  END IF;
  
  IF length(digits) = 10 AND (digits ~ '^7' OR digits ~ '^1' OR digits ~ '^2') THEN
    -- Missing leading 0
    RETURN '0' || digits;
  END IF;
  
  IF length(digits) = 12 AND digits ~ '^44' THEN
    -- International format (+44)
    normalized_phone := '0' || substring(digits from 3);
    IF length(normalized_phone) = 11 AND (normalized_phone ~ '^07' OR normalized_phone ~ '^01' OR normalized_phone ~ '^02') THEN
      RETURN normalized_phone;
    END IF;
  END IF;
  
  IF length(digits) = 13 AND digits ~ '^447' THEN
    -- International format with mobile (+447)
    normalized_phone := '0' || substring(digits from 3);
    IF length(normalized_phone) = 11 AND normalized_phone ~ '^07' THEN
      RETURN normalized_phone;
    END IF;
  END IF;
  
  -- If we can't normalize it, return the original input
  RETURN phone_input;
END;
$$;

-- Normalize phone numbers in customers table
UPDATE customers 
SET phone = normalize_uk_phone(phone)
WHERE phone IS NOT NULL AND phone != '';

-- Normalize phone numbers in reservations table
UPDATE reservations 
SET phone = normalize_uk_phone(phone)
WHERE phone IS NOT NULL AND phone != '';

-- Normalize phone numbers in company_settings table
UPDATE company_settings 
SET phone = normalize_uk_phone(phone)
WHERE phone IS NOT NULL AND phone != '';

-- Normalize phone numbers in locations table
UPDATE locations 
SET phone = normalize_uk_phone(phone)
WHERE phone IS NOT NULL AND phone != '';

-- Update the handle_new_customer function to normalize phone numbers
CREATE OR REPLACE FUNCTION public.handle_new_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_customer_id uuid;
  normalized_phone text;
BEGIN
  -- Normalize the phone number
  normalized_phone := normalize_uk_phone(NEW.phone);
  
  -- First check if customer exists by normalized phone number (primary identifier)
  SELECT id INTO existing_customer_id
  FROM customers 
  WHERE phone = normalized_phone AND normalized_phone IS NOT NULL AND normalized_phone != '';

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
      END,
      -- Update phone with normalized version
      phone = CASE 
        WHEN (phone IS NULL OR phone = '') AND normalized_phone IS NOT NULL AND normalized_phone != ''
        THEN normalized_phone
        ELSE phone 
      END
    WHERE id = existing_customer_id;
  ELSE
    -- Customer doesn't exist, create new record with normalized phone
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
      normalized_phone,
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