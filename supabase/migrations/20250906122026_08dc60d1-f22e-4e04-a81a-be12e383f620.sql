-- Fix remaining functions with mutable search_path issues
-- These are the final security fixes to complete company isolation

-- Update any remaining functions that might not have proper search_path
-- Fix generate_unique_pin function
CREATE OR REPLACE FUNCTION public.generate_unique_pin(p_company_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_pin text;
  pin_exists boolean;
BEGIN
  LOOP
    -- Generate a random 4-digit PIN
    new_pin := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    
    -- Check if PIN already exists within the company (not globally)
    IF p_company_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.users 
        WHERE pin_code = new_pin AND company_id = p_company_id
      ) INTO pin_exists;
    ELSE
      -- Fallback to global check if no company specified
      SELECT EXISTS(SELECT 1 FROM public.users WHERE pin_code = new_pin) INTO pin_exists;
    END IF;
    
    -- If PIN doesn't exist within the company, return it
    IF NOT pin_exists THEN
      RETURN new_pin;
    END IF;
  END LOOP;
END;
$function$;

-- Fix get_company_for_pin_user function
CREATE OR REPLACE FUNCTION public.get_company_for_pin_user(pin_input text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  company_uuid uuid;
BEGIN
  -- Check owner PIN first
  SELECT id INTO company_uuid
  FROM companies
  WHERE owner_pin = pin_input
    AND status = 'active';
    
  IF company_uuid IS NOT NULL THEN
    RETURN company_uuid;
  END IF;
  
  -- Check user PIN
  SELECT company_id INTO company_uuid
  FROM users
  WHERE pin_code = pin_input
    AND is_active = true;
    
  RETURN company_uuid;
END;
$function$;

-- Fix hash_pin_md5 function
CREATE OR REPLACE FUNCTION public.hash_pin_md5(pin_text text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Use md5 with salt for now (better than plaintext)
  RETURN md5(pin_text || 'pin_salt_2025');
END;
$function$;

-- Fix hash_password_md5 function
CREATE OR REPLACE FUNCTION public.hash_password_md5(password_text text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Use md5 with salt for now (better than plaintext)
  RETURN md5(password_text || 'salt_2025');
END;
$function$;

-- Fix check_auth_rate_limit function
CREATE OR REPLACE FUNCTION public.check_auth_rate_limit(identifier text, max_attempts integer DEFAULT 5, window_minutes integer DEFAULT 15)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  attempt_count integer;
BEGIN
  -- Count failed attempts in the time window
  SELECT COUNT(*) INTO attempt_count
  FROM auth_attempts
  WHERE (email = identifier OR pin_used = length(identifier)::text)
    AND success = false
    AND attempted_at > (now() - (window_minutes || ' minutes')::interval);
  
  -- Return false if rate limit exceeded
  IF attempt_count >= max_attempts THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$function$;

-- Add additional company isolation validation for timeline optimization
-- This ensures the timeline optimization service can't accidentally cross companies
CREATE OR REPLACE FUNCTION public.validate_reservation_company_access(p_reservation_id uuid, p_expected_company_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actual_company_id uuid;
BEGIN
  -- Get the actual company_id for the reservation
  SELECT company_id INTO actual_company_id
  FROM public.reservations
  WHERE id = p_reservation_id;
  
  -- Return true only if the companies match
  RETURN (actual_company_id = p_expected_company_id);
END;
$function$;

-- Create a function to validate table assignments stay within company
CREATE OR REPLACE FUNCTION public.validate_table_company_access(p_table_id uuid, p_expected_company_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actual_company_id uuid;
BEGIN
  -- Get the actual company_id for the table
  SELECT company_id INTO actual_company_id
  FROM public.tables
  WHERE id = p_table_id;
  
  -- Return true only if the companies match
  RETURN (actual_company_id = p_expected_company_id);
END;
$function$;