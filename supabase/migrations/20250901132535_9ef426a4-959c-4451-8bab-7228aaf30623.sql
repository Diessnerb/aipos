-- Comprehensive PIN Authentication Fix Migration (Fixed)

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
  rate_limit_key text;
  user_result RECORD;
  owner_result RECORD;
BEGIN
  -- Validate PIN format
  IF pin_input !~ '^[0-9]{4}$' THEN
    RETURN;
  END IF;

  -- Implement rate limiting per company
  rate_limit_key := 'pin_company_' || company_id_param::text;
  
  -- Check recent failed attempts for this company (with error handling)
  BEGIN
    SELECT COUNT(*) INTO attempt_count
    FROM public.auth_attempts
    WHERE company_id = company_id_param
      AND success = false
      AND attempted_at > (now() - interval '15 minutes');
  EXCEPTION WHEN OTHERS THEN
    -- If auth_attempts query fails, continue but log
    attempt_count := 0;
    RAISE LOG 'Failed to check auth attempts: %', SQLERRM;
  END;
  
  -- Block if too many attempts for this company
  IF attempt_count >= 10 THEN
    -- Log the blocked attempt (with error handling)
    BEGIN
      INSERT INTO public.auth_attempts (pin_used, success, attempted_at, company_id)
      VALUES (pin_input, false, now(), company_id_param);
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Failed to log auth attempt: %', SQLERRM;
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
  IF user_result IS NOT NULL THEN
    BEGIN
      INSERT INTO public.auth_attempts (pin_used, success, attempted_at, company_id)
      VALUES (pin_input, true, now(), company_id_param);
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Failed to log successful auth attempt: %', SQLERRM;
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

  -- Log attempt result (with error handling)
  BEGIN
    IF owner_result IS NOT NULL THEN
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
    RAISE LOG 'Failed to log auth attempt result: %', SQLERRM;
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

-- Step 4: Create unique indexes for per-company PIN uniqueness (if they don't exist)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_pin_company_unique 
ON public.users (pin_code, company_id) 
WHERE pin_code IS NOT NULL AND is_active = true;

-- Step 5: Update invite_team_member_with_pin function to ensure proper company scoping
CREATE OR REPLACE FUNCTION public.invite_team_member_with_pin(p_email text, p_full_name text, p_role text, p_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_user_role text;
  v_is_company_admin boolean;
  v_auth_user_id uuid;
  v_public_user_id uuid;
  v_hashed_pin text;
  v_pin_exists boolean;
BEGIN
  -- Validate PIN format
  IF p_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  -- Get current user's company and permissions
  SELECT u.company_id, u.role, u.is_company_admin
  INTO v_company_id, v_user_role, v_is_company_admin
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  -- Check permissions
  IF NOT (v_user_role = 'admin' OR v_is_company_admin) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions to invite team members');
  END IF;

  -- Hash the PIN consistently
  v_hashed_pin := md5(p_pin || 'pin_salt_2025');

  -- Check if PIN already exists in the company (check both hashed and plaintext for safety)
  SELECT EXISTS(
    SELECT 1 FROM public.users 
    WHERE (pin_code = v_hashed_pin OR pin_code = p_pin)
      AND company_id = v_company_id
      AND is_active = true
  ) INTO v_pin_exists;

  IF v_pin_exists THEN
    RETURN json_build_object('success', false, 'error', 'This PIN is already in use within your company');
  END IF;

  -- Check if auth user already exists
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  IF v_auth_user_id IS NOT NULL THEN
    -- Update existing auth user
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_build_object(
      'full_name', p_full_name,
      'role', p_role
    ),
    updated_at = now()
    WHERE id = v_auth_user_id;
    
    -- Update or create public.users record
    INSERT INTO public.users (auth_user_id, email, full_name, role, company_id, pin_code, is_active)
    VALUES (v_auth_user_id, p_email, p_full_name, p_role, v_company_id, v_hashed_pin, true)
    ON CONFLICT (auth_user_id) 
    DO UPDATE SET 
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      company_id = EXCLUDED.company_id,
      pin_code = EXCLUDED.pin_code,
      is_active = true
    RETURNING id INTO v_public_user_id;
  ELSE
    -- Create new auth user
    INSERT INTO auth.users (
      email, 
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_user_meta_data
    ) VALUES (
      p_email,
      crypt(p_pin, gen_salt('bf')), -- Use PIN as temporary password
      now(),
      now(),
      now(),
      jsonb_build_object('full_name', p_full_name, 'role', p_role)
    )
    RETURNING id INTO v_auth_user_id;

    -- Create public.users record with hashed PIN
    INSERT INTO public.users (auth_user_id, email, full_name, role, company_id, pin_code, is_active)
    VALUES (v_auth_user_id, p_email, p_full_name, p_role, v_company_id, v_hashed_pin, true)
    RETURNING id INTO v_public_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Team member invited successfully',
    'user_id', v_public_user_id,
    'pin', p_pin  -- Return the plaintext PIN for the admin to share
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Step 6: Update change_team_member_pin function to ensure proper hashing
CREATE OR REPLACE FUNCTION public.change_team_member_pin(p_member_id uuid, p_new_pin text, p_owner_pin text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_user_company_id uuid;
  v_member_company_id uuid;
  v_user_role text;
  v_is_company_admin boolean;
  v_hashed_new_pin text;
  v_hashed_owner_pin text;
  v_stored_owner_pin text;
  v_pin_exists boolean;
BEGIN
  -- Validate new PIN format
  IF p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  -- Get current user's company and permissions
  SELECT u.company_id, u.role, u.is_company_admin
  INTO v_current_user_company_id, v_user_role, v_is_company_admin
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  -- Get member's company
  SELECT u.company_id
  INTO v_member_company_id
  FROM public.users u
  WHERE u.id = p_member_id
  LIMIT 1;

  -- Check if member exists and is in the same company
  IF v_member_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Team member not found');
  END IF;

  IF v_current_user_company_id != v_member_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot change PIN for member in another company');
  END IF;

  -- Hash the new PIN consistently
  v_hashed_new_pin := md5(p_new_pin || 'pin_salt_2025');

  -- Check if new PIN already exists in the company (excluding the current member)
  SELECT EXISTS(
    SELECT 1 FROM public.users 
    WHERE (pin_code = v_hashed_new_pin OR pin_code = p_new_pin)
      AND company_id = v_current_user_company_id
      AND id != p_member_id
      AND is_active = true
  ) INTO v_pin_exists;

  IF v_pin_exists THEN
    RETURN json_build_object('success', false, 'error', 'This PIN is already in use within your company');
  END IF;

  -- Check permissions - if owner PIN is provided, validate it
  IF p_owner_pin IS NOT NULL THEN
    -- Validate owner PIN format
    IF p_owner_pin !~ '^[0-9]{4}$' THEN
      RETURN json_build_object('success', false, 'error', 'Owner PIN must be exactly 4 digits');
    END IF;

    -- Get stored owner PIN
    SELECT owner_pin INTO v_stored_owner_pin
    FROM public.companies
    WHERE id = v_current_user_company_id
    LIMIT 1;

    -- Hash the provided owner PIN
    v_hashed_owner_pin := md5(p_owner_pin || 'pin_salt_2025');

    -- Verify owner PIN (with backward compatibility)
    IF v_stored_owner_pin IS NULL OR (v_stored_owner_pin != v_hashed_owner_pin AND v_stored_owner_pin != p_owner_pin) THEN
      RETURN json_build_object('success', false, 'error', 'Invalid owner PIN');
    END IF;
  ELSE
    -- Check if user has admin permissions
    IF NOT (v_user_role = 'admin' OR v_is_company_admin) THEN
      RETURN json_build_object('success', false, 'error', 'Insufficient permissions or owner PIN required');
    END IF;
  END IF;

  -- Update the member's PIN with hashed value
  UPDATE public.users
  SET pin_code = v_hashed_new_pin
  WHERE id = p_member_id;

  RETURN json_build_object('success', true, 'message', 'PIN changed successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;