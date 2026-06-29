-- Update the authenticate_by_pin_secure function to handle both hashed and plaintext PINs
-- This ensures backward compatibility while supporting both storage formats
CREATE OR REPLACE FUNCTION public.authenticate_by_pin_secure(pin_input text)
RETURNS TABLE(user_id uuid, email text, full_name text, role text, company_id uuid, is_owner boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Hash the input PIN for comparison with hashed stored PINs
  hashed_input := md5(pin_input || 'pin_salt_2025');

  -- First check for regular user PINs (support both hashed and plaintext)
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.role,
    u.company_id,
    false as is_owner
  FROM users u
  WHERE (u.pin_code = hashed_input OR u.pin_code = pin_input)
    AND u.is_active = true
  LIMIT 1;

  -- If user found, log successful attempt
  IF FOUND THEN
    INSERT INTO auth_attempts (pin_used, success, attempted_at)
    VALUES (pin_input, true, now());
    RETURN;
  END IF;

  -- If no user found, check for owner PIN (support both hashed and plaintext)
  RETURN QUERY
  SELECT 
    gen_random_uuid() as user_id, -- Generate temporary ID for owner
    c.default_admin_email as email,
    'Restaurant Owner' as full_name,
    'owner' as role,
    c.id as company_id,
    true as is_owner
  FROM companies c
  WHERE (c.owner_pin = hashed_input OR c.owner_pin = pin_input)
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