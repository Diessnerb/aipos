-- Fix security warnings by ensuring all existing functions have proper search_path settings
-- This addresses the Function Search Path Mutable warning

-- Update authenticate_by_pin_secure_v2 to ensure proper search_path
CREATE OR REPLACE FUNCTION public.authenticate_by_pin_secure_v2(pin_input text)
 RETURNS TABLE(user_id uuid, email text, full_name text, role text, company_id uuid, is_owner boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  hashed_input text;
  attempt_count integer;
  rate_limit_key text;
BEGIN
  -- Validate PIN format
  IF pin_input !~ '^[0-9]{4}$' THEN
    RETURN;
  END IF;

  -- Implement rate limiting
  rate_limit_key := 'pin_' || pin_input;
  
  -- Check recent failed attempts
  SELECT COUNT(*) INTO attempt_count
  FROM auth_attempts
  WHERE pin_used = pin_input
    AND success = false
    AND attempted_at > (now() - interval '15 minutes');
  
  -- Block if too many attempts
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

  -- If user found, log successful attempt
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
$function$;

-- Fix update_user_pin function
CREATE OR REPLACE FUNCTION public.update_user_pin(p_user_id uuid, p_new_pin text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hashed_pin text;
BEGIN
  -- Only super admins can update user PINs
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Validate PIN format
  IF p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;
  
  -- Hash the PIN
  v_hashed_pin := md5(p_new_pin || 'pin_salt_2025');
  
  -- Check if PIN already exists for another user
  IF EXISTS (SELECT 1 FROM public.users WHERE pin_code = v_hashed_pin AND id != p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'PIN already exists');
  END IF;
  
  -- Update the PIN
  UPDATE public.users 
  SET pin_code = v_hashed_pin
  WHERE id = p_user_id;
  
  RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
END;
$function$;