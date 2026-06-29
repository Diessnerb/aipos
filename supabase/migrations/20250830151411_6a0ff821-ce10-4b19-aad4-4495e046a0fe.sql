-- Create company-scoped PIN authentication function
CREATE OR REPLACE FUNCTION public.authenticate_by_pin_for_company(
  pin_input text, 
  company_id_param uuid
)
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

  -- Implement rate limiting per company
  rate_limit_key := 'pin_company_' || company_id_param::text;
  
  -- Check recent failed attempts for this company
  SELECT COUNT(*) INTO attempt_count
  FROM auth_attempts
  WHERE company_id = company_id_param
    AND success = false
    AND attempted_at > (now() - interval '15 minutes');
  
  -- Block if too many attempts for this company
  IF attempt_count >= 10 THEN
    -- Log the blocked attempt
    INSERT INTO auth_attempts (pin_used, success, attempted_at, company_id)
    VALUES (pin_input, false, now(), company_id_param);
    RETURN;
  END IF;

  -- Hash the input PIN for comparison
  hashed_input := md5(pin_input || 'pin_salt_2025');

  -- First check for regular user PINs within the specified company
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

  -- If no user found, check for owner PIN within the specified company
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
$function$;

-- Update generate_unique_pin to be company-scoped
CREATE OR REPLACE FUNCTION public.generate_unique_pin(p_company_id uuid DEFAULT NULL)
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

-- Update create_pin_user to hash PINs and ensure company-scoped uniqueness
CREATE OR REPLACE FUNCTION public.create_pin_user(
  p_full_name text, 
  p_role text, 
  p_pin_code text, 
  p_company_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_user_id uuid;
  generated_email text;
  hashed_pin text;
BEGIN
  -- Validate PIN format
  IF p_pin_code !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;

  -- Hash the PIN
  hashed_pin := md5(p_pin_code || 'pin_salt_2025');

  -- Check if PIN already exists within the same company (not globally)
  IF p_company_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM users WHERE pin_code = hashed_pin AND company_id = p_company_id) THEN
      RAISE EXCEPTION 'PIN already exists within this company';
    END IF;
  ELSE
    -- Fallback to global check if no company specified
    IF EXISTS (SELECT 1 FROM users WHERE pin_code = hashed_pin) THEN
      RAISE EXCEPTION 'PIN already exists';
    END IF;
  END IF;

  -- Generate a unique email-like identifier
  generated_email := lower(replace(p_full_name, ' ', '.')) || '.' || p_pin_code || '@internal.staff';

  -- Create the user record with hashed PIN
  INSERT INTO public.users (
    full_name,
    email,
    role,
    pin_code,
    company_id
  ) VALUES (
    p_full_name,
    generated_email,
    p_role,
    hashed_pin,
    p_company_id
  ) RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$function$;

-- Update update_user_pin_with_permissions to hash PINs and ensure company-scoped uniqueness
CREATE OR REPLACE FUNCTION public.update_user_pin_with_permissions(
  p_target_user_id uuid, 
  p_new_pin text, 
  p_owner_pin text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_requester_role text;
  v_requester_company_id uuid;
  v_target_company_id uuid;
  v_target_role text;
  v_is_company_admin boolean;
  v_owner_company_id uuid;
  v_hashed_pin text;
BEGIN
  -- Validate format
  IF p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  -- Hash the new PIN
  v_hashed_pin := md5(p_new_pin || 'pin_salt_2025');

  -- Load target user
  SELECT company_id, role
  INTO v_target_company_id, v_target_role
  FROM public.users
  WHERE id = p_target_user_id AND is_active = true
  LIMIT 1;

  IF v_target_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Target user not found or inactive');
  END IF;

  -- Ensure PIN uniqueness within the target user's company (not globally)
  IF EXISTS (SELECT 1 FROM public.users WHERE pin_code = v_hashed_pin AND company_id = v_target_company_id AND id <> p_target_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'PIN already exists within this company');
  END IF;

  -- Owner path: allow using owner PIN without auth session
  IF p_owner_pin IS NOT NULL THEN
    SELECT id INTO v_owner_company_id
    FROM public.companies
    WHERE owner_pin = md5(p_owner_pin || 'pin_salt_2025') AND status = 'active'
    LIMIT 1;

    IF v_owner_company_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Invalid owner PIN');
    END IF;

    IF v_target_company_id <> v_owner_company_id THEN
      RETURN json_build_object('success', false, 'error', 'Owner can only manage users in their company');
    END IF;

    UPDATE public.users SET pin_code = v_hashed_pin WHERE id = p_target_user_id;
    RETURN json_build_object('success', true, 'message', 'PIN updated successfully (owner)');
  END IF;

  -- Authenticated path: requester must be admin/company admin in same company
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT role, company_id, is_company_admin
  INTO v_requester_role, v_requester_company_id, v_is_company_admin
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_requester_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Requester not linked to a company');
  END IF;

  IF v_requester_company_id <> v_target_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot manage users from another company');
  END IF;

  -- Only admins/company admins can change PINs
  IF NOT (v_requester_role = 'admin' OR v_is_company_admin) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Admins cannot change other admins' PINs
  IF v_target_role = 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Admins cannot change PIN for other admins');
  END IF;

  UPDATE public.users SET pin_code = v_hashed_pin WHERE id = p_target_user_id;
  RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;