-- Comprehensive PIN Authentication Fix Migration (Final)

-- Step 1: Drop and recreate authenticate_by_pin_for_company with proper error handling
DROP FUNCTION IF EXISTS public.authenticate_by_pin_for_company(text, uuid);

CREATE OR REPLACE FUNCTION public.authenticate_by_pin_for_company(pin_input text, company_id_param uuid)
RETURNS TABLE(user_id uuid, email text, full_name text, role text, company_id uuid, is_owner boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  hashed_input text;
  attempt_count integer;
  user_result RECORD;
  owner_result RECORD;
BEGIN
  -- Validate PIN format
  IF pin_input !~ '^[0-9]{4}$' THEN
    RETURN;
  END IF;

  -- Check recent failed attempts for this company (with error handling)
  BEGIN
    SELECT COUNT(*) INTO attempt_count
    FROM public.auth_attempts
    WHERE company_id = company_id_param
      AND success = false
      AND attempted_at > (now() - interval '15 minutes');
  EXCEPTION WHEN OTHERS THEN
    attempt_count := 0;
  END;
  
  -- Block if too many attempts for this company
  IF attempt_count >= 10 THEN
    BEGIN
      INSERT INTO public.auth_attempts (pin_used, success, attempted_at, company_id)
      VALUES (pin_input, false, now(), company_id_param);
    EXCEPTION WHEN OTHERS THEN
      -- Ignore logging errors
    END;
    RETURN;
  END IF;

  -- Hash the input PIN for comparison
  hashed_input := md5(pin_input || 'pin_salt_2025');

  -- Check for regular user PINs within the specified company (with backward compatibility)
  SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.role,
    u.company_id,
    false as is_owner
  INTO user_result
  FROM public.users u
  WHERE u.company_id = company_id_param
    AND u.is_active = true
    AND (u.pin_code = hashed_input OR u.pin_code = pin_input) -- Backward compatibility
  LIMIT 1;

  -- If user found, log successful attempt and return
  IF user_result.user_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.auth_attempts (pin_used, success, attempted_at, company_id)
      VALUES (pin_input, true, now(), company_id_param);
    EXCEPTION WHEN OTHERS THEN
      -- Ignore logging errors
    END;
    
    RETURN QUERY SELECT 
      user_result.user_id,
      user_result.email,
      user_result.full_name,
      user_result.role,
      user_result.company_id,
      user_result.is_owner;
    RETURN;
  END IF;

  -- If no user found, check for owner PIN within the specified company (with backward compatibility)
  SELECT 
    gen_random_uuid() as user_id, -- Generate temporary ID for owner
    c.default_admin_email as email,
    'Restaurant Owner' as full_name,
    'owner' as role,
    c.id as company_id,
    true as is_owner
  INTO owner_result
  FROM public.companies c
  WHERE c.id = company_id_param
    AND c.status = 'active'
    AND (c.owner_pin = hashed_input OR c.owner_pin = pin_input) -- Backward compatibility
  LIMIT 1;

  -- Log attempt result
  BEGIN
    IF owner_result.user_id IS NOT NULL THEN
      INSERT INTO public.auth_attempts (pin_used, success, attempted_at, company_id)
      VALUES (pin_input, true, now(), company_id_param);
      
      RETURN QUERY SELECT 
        owner_result.user_id,
        owner_result.email,
        owner_result.full_name,
        owner_result.role,
        owner_result.company_id,
        owner_result.is_owner;
    ELSE
      INSERT INTO public.auth_attempts (pin_used, success, attempted_at, company_id)
      VALUES (pin_input, false, now(), company_id_param);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore logging errors
  END;
END;
$function$;

-- Step 2: Update all plaintext PINs to hashed format for users
UPDATE public.users 
SET pin_code = md5(pin_code || 'pin_salt_2025')
WHERE pin_code IS NOT NULL 
  AND pin_code ~ '^[0-9]{4}$'  -- Only update if it looks like plaintext PIN
  AND length(pin_code) = 4;    -- Additional safety check

-- Step 3: Update all plaintext owner PINs to hashed format for companies
UPDATE public.companies 
SET owner_pin = md5(owner_pin || 'pin_salt_2025')
WHERE owner_pin IS NOT NULL 
  AND owner_pin ~ '^[0-9]{4}$'  -- Only update if it looks like plaintext PIN
  AND length(owner_pin) = 4;    -- Additional safety check

-- Step 4: Create unique index for per-company PIN uniqueness (without CONCURRENTLY)
DROP INDEX IF EXISTS idx_users_pin_company_unique;
CREATE UNIQUE INDEX idx_users_pin_company_unique 
ON public.users (pin_code, company_id) 
WHERE pin_code IS NOT NULL AND is_active = true;