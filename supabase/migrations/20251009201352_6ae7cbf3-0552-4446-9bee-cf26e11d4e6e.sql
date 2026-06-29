-- Restore automatic customer sync from reservations
-- This trigger ensures every reservation automatically creates or updates a customer record

-- Function to normalize and sync customer data from reservations
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
  -- Skip if no contact info or customer name provided
  IF (NEW.customer_name IS NULL OR NEW.customer_name = '') THEN
    RETURN NEW;
  END IF;
  
  IF (NEW.customer_phone IS NULL OR NEW.customer_phone = '') AND (NEW.customer_email IS NULL OR NEW.customer_email = '') THEN
    RETURN NEW;
  END IF;
  
  -- Normalize phone number for consistent matching
  normalized_phone := normalize_uk_phone(NEW.customer_phone);
  
  -- Try to find existing customer by normalized phone (primary match)
  IF normalized_phone IS NOT NULL AND normalized_phone != '' THEN
    SELECT id, COALESCE(visits, 0) INTO existing_customer_id, current_visits
    FROM customers 
    WHERE phone = normalized_phone 
      AND company_id = NEW.company_id
    LIMIT 1;
  END IF;
  
  -- Fallback: try to find by email if phone match failed
  IF existing_customer_id IS NULL AND NEW.customer_email IS NOT NULL AND NEW.customer_email != '' THEN
    SELECT id, COALESCE(visits, 0) INTO existing_customer_id, current_visits
    FROM customers 
    WHERE email = NEW.customer_email 
      AND company_id = NEW.company_id
    LIMIT 1;
  END IF;
  
  -- Update existing customer
  IF existing_customer_id IS NOT NULL THEN
    UPDATE customers SET
      -- Increment visit count
      visits = COALESCE(visits, 0) + 1,
      -- Update last visit to reservation date
      last_visit = NEW.date,
      -- Update name if new one is longer/better (keeps most complete version)
      name = CASE 
        WHEN LENGTH(NEW.customer_name) > LENGTH(name) THEN NEW.customer_name
        ELSE name
      END,
      -- Fill in missing email if provided
      email = COALESCE(email, NEW.customer_email),
      -- Fill in missing phone with normalized version if provided
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
      NEW.customer_email,
      normalized_phone,
      1, -- First visit
      NEW.date,
      false, -- Not VIP by default
      false, -- Can receive SMS by default
      false, -- Can contact by default
      0,
      0,
      0
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically sync customers from reservations
DROP TRIGGER IF EXISTS trigger_handle_new_customer ON reservations;
CREATE TRIGGER trigger_handle_new_customer
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW
  WHEN (NEW.customer_name IS NOT NULL AND NEW.customer_name != '')
  EXECUTE FUNCTION handle_new_customer();