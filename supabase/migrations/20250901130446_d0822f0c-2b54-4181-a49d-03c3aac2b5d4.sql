-- Fix PIN authentication issues by standardizing hashing
-- Step 1: Hash any remaining plaintext PINs in users table
UPDATE public.users 
SET pin_code = md5(pin_code || 'pin_salt_2025')
WHERE pin_code IS NOT NULL 
  AND pin_code ~ '^[0-9]{4}$'  -- Only update if it's a 4-digit plaintext PIN
  AND LENGTH(pin_code) = 4;

-- Step 2: Create/update the invite_team_member_with_pin function to use proper hashing
CREATE OR REPLACE FUNCTION public.invite_team_member_with_pin(
  p_email text,
  p_full_name text,
  p_role text,
  p_pin text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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

  -- Hash the PIN
  v_hashed_pin := md5(p_pin || 'pin_salt_2025');

  -- Check if PIN already exists in the company
  SELECT EXISTS(
    SELECT 1 FROM public.users 
    WHERE pin_code = v_hashed_pin 
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

    -- Create public.users record
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
$$;

-- Step 3: Create/update the change_team_member_pin function to use proper hashing
CREATE OR REPLACE FUNCTION public.change_team_member_pin(
  p_member_id uuid,
  p_new_pin text,
  p_owner_pin text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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

    -- Verify owner PIN
    IF v_stored_owner_pin IS NULL OR v_stored_owner_pin != v_hashed_owner_pin THEN
      RETURN json_build_object('success', false, 'error', 'Invalid owner PIN');
    END IF;
  ELSE
    -- If no owner PIN provided, check if user has admin permissions
    IF NOT (v_user_role = 'admin' OR v_is_company_admin) THEN
      RETURN json_build_object('success', false, 'error', 'Insufficient permissions. Admin rights or owner PIN required.');
    END IF;
  END IF;

  -- Hash the new PIN
  v_hashed_new_pin := md5(p_new_pin || 'pin_salt_2025');

  -- Check if new PIN already exists in the company
  SELECT EXISTS(
    SELECT 1 FROM public.users 
    WHERE pin_code = v_hashed_new_pin 
      AND company_id = v_current_user_company_id
      AND id != p_member_id
      AND is_active = true
  ) INTO v_pin_exists;

  IF v_pin_exists THEN
    RETURN json_build_object('success', false, 'error', 'This PIN is already in use within your company');
  END IF;

  -- Update the member's PIN
  UPDATE public.users
  SET pin_code = v_hashed_new_pin
  WHERE id = p_member_id;

  RETURN json_build_object('success', true, 'message', 'PIN changed successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;