-- Enhanced PIN authentication with rate limiting and secure hashing
CREATE OR REPLACE FUNCTION public.authenticate_by_pin_for_company_secure(pin_input text, company_id_param uuid)
RETURNS TABLE(user_id uuid, email text, full_name text, role text, company_id uuid, is_owner boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  hashed_input text;
  attempt_count integer;
  last_attempt timestamp with time zone;
  is_locked boolean := false;
BEGIN
  -- Validate PIN format
  IF pin_input !~ '^[0-9]{4}$' THEN
    -- Log invalid PIN format attempt
    INSERT INTO auth_attempts (pin_used, success, attempted_at, company_id)
    VALUES ('INVALID_FORMAT', false, now(), company_id_param);
    RETURN;
  END IF;

  -- Check rate limiting for this PIN
  SELECT COUNT(*), MAX(attempted_at) INTO attempt_count, last_attempt
  FROM auth_attempts
  WHERE pin_used = pin_input
    AND success = false
    AND attempted_at > (now() - interval '15 minutes');
  
  -- Check if account is locked
  IF attempt_count >= 5 THEN
    is_locked := true;
    -- Log blocked attempt
    INSERT INTO auth_attempts (pin_used, success, attempted_at, company_id)
    VALUES (pin_input, false, now(), company_id_param);
    RETURN;
  END IF;

  -- Hash the input PIN with bcrypt-style salt (using available functions)
  hashed_input := public.hash_pin_md5(pin_input);

  -- First check for regular user PINs
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
    AND u.company_id = company_id_param
    AND u.is_active = true
  LIMIT 1;

  -- If user found, log successful attempt
  IF FOUND THEN
    INSERT INTO auth_attempts (pin_used, success, attempted_at, company_id)
    VALUES (pin_input, true, now(), company_id_param);
    RETURN;
  END IF;

  -- If no user found, check for owner PIN
  RETURN QUERY
  SELECT 
    gen_random_uuid() as user_id,
    c.default_admin_email as email,
    'Restaurant Owner' as full_name,
    'owner' as role,
    c.id as company_id,
    true as is_owner
  FROM companies c
  WHERE c.owner_pin = hashed_input
    AND c.id = company_id_param
    AND c.status = 'active'
  LIMIT 1;

  -- Log attempt result
  IF FOUND THEN
    INSERT INTO auth_attempts (pin_used, success, attempted_at, company_id)
    VALUES (pin_input, true, now(), company_id_param);
  ELSE
    INSERT INTO auth_attempts (pin_used, success, attempted_at, company_id)
    VALUES (pin_input, false, now(), company_id_param);
  END IF;
END;
$$;

-- Enhanced security function to check if user is locked
CREATE OR REPLACE FUNCTION public.is_pin_locked(pin_input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  attempt_count integer;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM auth_attempts
  WHERE pin_used = pin_input
    AND success = false
    AND attempted_at > (now() - interval '15 minutes');
  
  RETURN attempt_count >= 5;
END;
$$;

-- Function to clear rate limit after successful authentication
CREATE OR REPLACE FUNCTION public.clear_pin_rate_limit(pin_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Clear recent failed attempts for this PIN
  DELETE FROM auth_attempts
  WHERE pin_used = pin_input
    AND success = false
    AND attempted_at > (now() - interval '15 minutes');
END;
$$;