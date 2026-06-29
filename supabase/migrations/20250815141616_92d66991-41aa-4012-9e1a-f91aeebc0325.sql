-- Fix remaining function search path issues
ALTER FUNCTION public.normalize_uk_phone SET search_path = 'public';
ALTER FUNCTION public.generate_unique_pin SET search_path = 'public';
ALTER FUNCTION public.hash_pin_md5 SET search_path = 'public';

-- Update all other security definer functions that might be missing search path
ALTER FUNCTION public.set_company_id_from_user SET search_path = 'public';
ALTER FUNCTION public.trigger_set_timestamp SET search_path = 'public';
ALTER FUNCTION public.set_reservation_defaults SET search_path = 'public';
ALTER FUNCTION public.auto_assign_table_on_insert SET search_path = 'public';
ALTER FUNCTION public.add_user_to_all_channels SET search_path = 'public';
ALTER FUNCTION public.add_all_users_to_channel SET search_path = 'public';
ALTER FUNCTION public.handle_new_customer SET search_path = 'public';
ALTER FUNCTION public.deduct_holiday_days_on_approval SET search_path = 'public';
ALTER FUNCTION public.calculate_shift_duration SET search_path = 'public';

-- Remove the old insecure authentication function
DROP FUNCTION IF EXISTS public.authenticate_by_pin(text);

-- Update the existing secure function to be even more secure
CREATE OR REPLACE FUNCTION public.authenticate_by_pin_secure(pin_input text)
RETURNS TABLE(user_id uuid, email text, full_name text, role text, company_id uuid, is_owner boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  hashed_input text;
  attempt_count integer;
BEGIN
  -- Validate PIN format
  IF pin_input !~ '^[0-9]{4}$' THEN
    RETURN;
  END IF;

  -- Implement rate limiting - check recent failed attempts
  SELECT COUNT(*) INTO attempt_count
  FROM auth_attempts
  WHERE pin_used = pin_input
    AND success = false
    AND attempted_at > (now() - interval '15 minutes');
  
  -- Block if too many attempts (rate limiting)
  IF attempt_count >= 5 THEN
    -- Log the blocked attempt
    INSERT INTO auth_attempts (pin_used, success, attempted_at)
    VALUES (pin_input, false, now());
    RETURN;
  END IF;

  -- Hash the input PIN for comparison
  hashed_input := md5(pin_input || 'pin_salt_2025');

  -- First check for regular user PINs using hashed comparison
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.role,
    u.company_id,
    false as is_owner
  FROM users u
  WHERE u.pin_code = hashed_input
    AND u.is_active = true
  LIMIT 1;

  -- If user found, log successful attempt and return
  IF FOUND THEN
    INSERT INTO auth_attempts (pin_used, success, attempted_at)
    VALUES (pin_input, true, now());
    RETURN;
  END IF;

  -- If no user found, check for owner PIN using hashed comparison
  RETURN QUERY
  SELECT 
    gen_random_uuid() as user_id, -- Generate temporary ID for owner
    c.default_admin_email as email,
    'Restaurant Owner' as full_name,
    'owner' as role,
    c.id as company_id,
    true as is_owner
  FROM companies c
  WHERE c.owner_pin = hashed_input
    AND c.status = 'active'
  LIMIT 1;

  -- Log attempt result
  IF FOUND THEN
    INSERT INTO auth_attempts (pin_used, success, attempted_at)
    VALUES (pin_input, true, now());
  ELSE
    INSERT INTO auth_attempts (pin_used, success, attempted_at)
    VALUES (pin_input, false, now());
  END IF;
END;
$$;