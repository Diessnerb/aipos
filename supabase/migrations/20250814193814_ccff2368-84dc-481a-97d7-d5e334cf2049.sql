-- Fix the create_company_with_admin function to use consistent super admin check
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  p_company_name text,
  p_subdomain text,
  p_admin_email text,
  p_admin_password text,
  p_admin_full_name text DEFAULT 'Company Admin'::text,
  p_owner_pin text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_auth_user_id uuid;
  v_public_user_id uuid;
BEGIN
  -- Only super admins can create companies - use consistent function
  IF NOT public.is_current_user_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized - not a super admin');
  END IF;

  -- Check if subdomain already exists
  IF EXISTS (SELECT 1 FROM public.companies WHERE subdomain = p_subdomain) THEN
    RETURN json_build_object('success', false, 'error', 'Subdomain already exists');
  END IF;

  -- Check if admin email already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_admin_email) THEN
    RETURN json_build_object('success', false, 'error', 'Admin email already exists');
  END IF;

  BEGIN
    -- Step 1: Create the company
    INSERT INTO public.companies (name, subdomain, default_admin_email, default_admin_password, owner_pin, status)
    VALUES (p_company_name, p_subdomain, p_admin_email, p_admin_password, p_owner_pin, 'active')
    RETURNING id INTO v_company_id;
    
    IF v_company_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Failed to create company');
    END IF;

    -- Step 2: Create auth user
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
    )
    RETURNING id INTO v_auth_user_id;
    
    IF v_auth_user_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Failed to create auth user');
    END IF;

    -- Step 3: Create public user record
    INSERT INTO public.users (
      auth_user_id,
      email,
      full_name,
      role,
      company_id,
      is_company_admin,
      is_active
    ) VALUES (
      v_auth_user_id,
      p_admin_email,
      p_admin_full_name,
      'admin',
      v_company_id,
      true,
      true
    )
    RETURNING id INTO v_public_user_id;
    
    IF v_public_user_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Failed to create public user record');
    END IF;

    -- Step 4: Create company settings
    INSERT INTO public.company_settings (company_id, company_name)
    VALUES (v_company_id, p_company_name);

    RETURN json_build_object(
      'success', true,
      'message', 'Company and admin user created successfully',
      'company_id', v_company_id,
      'auth_user_id', v_auth_user_id,
      'public_user_id', v_public_user_id
    );

  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Database error: ' || SQLERRM,
      'error_detail', SQLSTATE
    );
  END;
END;
$function$;