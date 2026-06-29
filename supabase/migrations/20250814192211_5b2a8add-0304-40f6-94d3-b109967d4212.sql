-- Fix the create_company_with_admin function to match working patterns
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
AS $$
DECLARE
  v_company_id uuid;
  v_auth_user_id uuid;
  v_public_user_id uuid;
BEGIN
  -- Only super admins can create companies
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized - not a super admin');
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

  IF p_owner_pin IS NULL OR trim(p_owner_pin) = '' OR length(trim(p_owner_pin)) != 4 THEN
    RETURN json_build_object('success', false, 'error', 'Owner PIN must be exactly 4 digits');
  END IF;

  -- Check if subdomain already exists
  IF EXISTS (SELECT 1 FROM public.companies WHERE subdomain = p_subdomain) THEN
    RETURN json_build_object('success', false, 'error', 'Subdomain already exists');
  END IF;

  -- Check if admin email already exists in companies
  IF EXISTS (SELECT 1 FROM public.companies WHERE default_admin_email = p_admin_email) THEN
    RETURN json_build_object('success', false, 'error', 'Admin email already exists for another company');
  END IF;

  -- Check if owner PIN already exists
  IF EXISTS (SELECT 1 FROM public.companies WHERE owner_pin = p_owner_pin) THEN
    RETURN json_build_object('success', false, 'error', 'Owner PIN already exists');
  END IF;

  BEGIN
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
    )
    RETURNING id INTO v_company_id;

    -- Create auth user for the admin
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
      json_build_object(
        'full_name', p_admin_full_name,
        'role', 'admin'
      )
    )
    RETURNING id INTO v_auth_user_id;

    -- Create public user record
    INSERT INTO public.users (
      auth_user_id,
      email,
      full_name,
      role,
      company_id,
      is_company_admin
    ) VALUES (
      v_auth_user_id,
      p_admin_email,
      p_admin_full_name,
      'admin',
      v_company_id,
      true
    )
    RETURNING id INTO v_public_user_id;

    RETURN json_build_object(
      'success', true,
      'message', 'Company created successfully',
      'company_id', v_company_id,
      'admin_user_id', v_public_user_id
    );

  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to create company: ' || SQLERRM
    );
  END;
END;
$$;