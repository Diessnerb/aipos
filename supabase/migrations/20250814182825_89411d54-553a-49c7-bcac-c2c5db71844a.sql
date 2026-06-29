-- Fix create_company_with_admin function to properly create auth users
DROP FUNCTION IF EXISTS public.create_company_with_admin(p_company_name text, p_subdomain text, p_admin_email text, p_admin_password text, p_admin_full_name text, p_owner_pin text);
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  p_company_name text,
  p_subdomain text,
  p_admin_email text,
  p_admin_password text,
  p_admin_full_name text,
  p_owner_pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id uuid;
  new_auth_user_id uuid;
  new_user_id uuid;
  generated_pin text;
BEGIN
  -- Only super admins can create companies
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate inputs
  IF p_company_name IS NULL OR trim(p_company_name) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Company name is required');
  END IF;

  IF p_subdomain IS NULL OR trim(p_subdomain) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Subdomain is required');
  END IF;

  IF p_admin_email IS NULL OR trim(p_admin_email) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Admin email is required');
  END IF;

  IF p_admin_password IS NULL OR trim(p_admin_password) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Admin password is required');
  END IF;

  IF p_owner_pin IS NULL OR p_owner_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'Owner PIN must be exactly 4 digits');
  END IF;

  -- Check if subdomain already exists
  IF EXISTS (SELECT 1 FROM public.companies WHERE subdomain = p_subdomain) THEN
    RETURN json_build_object('success', false, 'error', 'Subdomain already exists');
  END IF;

  -- Check if admin email already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_admin_email) THEN
    RETURN json_build_object('success', false, 'error', 'Admin email already exists');
  END IF;

  -- Check if owner PIN already exists
  IF EXISTS (SELECT 1 FROM public.companies WHERE owner_pin = p_owner_pin) THEN
    RETURN json_build_object('success', false, 'error', 'Owner PIN already exists');
  END IF;

  -- Create the company
  INSERT INTO public.companies (
    name,
    subdomain,
    status,
    default_admin_email,
    default_admin_password,
    owner_pin
  ) VALUES (
    p_company_name,
    p_subdomain,
    'active',
    p_admin_email,
    p_admin_password,
    p_owner_pin
  ) RETURNING id INTO new_company_id;

  -- Create auth user
  INSERT INTO auth.users (
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data
  ) VALUES (
    p_admin_email,
    crypt(p_admin_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    json_build_object('full_name', p_admin_full_name, 'role', 'admin')
  ) RETURNING id INTO new_auth_user_id;

  -- Generate unique PIN for admin user
  generated_pin := public.generate_unique_pin();

  -- Create public user record
  INSERT INTO public.users (
    auth_user_id,
    email,
    full_name,
    role,
    company_id,
    is_company_admin,
    pin_code
  ) VALUES (
    new_auth_user_id,
    p_admin_email,
    p_admin_full_name,
    'admin',
    new_company_id,
    true,
    generated_pin
  ) RETURNING id INTO new_user_id;

  -- Apply system default permissions to the new company
  PERFORM public.apply_system_defaults_to_new_company(new_company_id);

  RETURN json_build_object(
    'success', true,
    'message', 'Company and admin created successfully',
    'company_id', new_company_id,
    'admin_user_id', new_user_id,
    'admin_pin', generated_pin
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Create recovery function for existing companies without auth users
CREATE OR REPLACE FUNCTION public.fix_company_missing_auth_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  company_record record;
  new_auth_user_id uuid;
  fixed_count integer := 0;
  error_count integer := 0;
  results json[] := '{}';
BEGIN
  -- Only super admins can run this
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Find companies with public users but no corresponding auth users
  FOR company_record IN
    SELECT DISTINCT
      c.id as company_id,
      c.name as company_name,
      c.default_admin_email,
      c.default_admin_password,
      u.id as user_id,
      u.full_name,
      u.email
    FROM public.companies c
    JOIN public.users u ON u.company_id = c.id AND u.is_company_admin = true
    WHERE u.auth_user_id IS NULL
      AND c.default_admin_email IS NOT NULL
      AND c.default_admin_password IS NOT NULL
  LOOP
    BEGIN
      -- Create auth user for this company admin
      INSERT INTO auth.users (
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_user_meta_data
      ) VALUES (
        company_record.default_admin_email,
        crypt(company_record.default_admin_password, gen_salt('bf')),
        now(),
        now(),
        now(),
        json_build_object('full_name', company_record.full_name, 'role', 'admin')
      ) RETURNING id INTO new_auth_user_id;

      -- Link the public user to the auth user
      UPDATE public.users
      SET auth_user_id = new_auth_user_id
      WHERE id = company_record.user_id;

      fixed_count := fixed_count + 1;
      results := results || json_build_object(
        'company_id', company_record.company_id,
        'company_name', company_record.company_name,
        'email', company_record.default_admin_email,
        'status', 'fixed'
      );

    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        results := results || json_build_object(
          'company_id', company_record.company_id,
          'company_name', company_record.company_name,
          'email', company_record.default_admin_email,
          'status', 'error',
          'error_message', SQLERRM
        );
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', format('Fixed %s companies, %s errors', fixed_count, error_count),
    'fixed_count', fixed_count,
    'error_count', error_count,
    'results', results
  );
END;
$function$;