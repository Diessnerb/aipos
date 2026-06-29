-- Replace the create_company_with_admin function to avoid auth.users manipulation
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  p_company_name text,
  p_subdomain text,
  p_admin_email text,
  p_admin_password text,
  p_admin_full_name text DEFAULT 'Company Admin'::text,
  p_owner_pin text DEFAULT NULL::text,
  p_auth_user_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_public_user_id uuid;
BEGIN
  -- Only super admins can create companies
  IF NOT public.is_current_user_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized - not a super admin');
  END IF;

  -- Check if subdomain already exists
  IF EXISTS (SELECT 1 FROM public.companies WHERE subdomain = p_subdomain) THEN
    RETURN json_build_object('success', false, 'error', 'Subdomain already exists');
  END IF;

  -- Auth user ID is required (should be created on frontend)
  IF p_auth_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Auth user ID is required');
  END IF;

  BEGIN
    -- Step 1: Create the company
    INSERT INTO public.companies (name, subdomain, default_admin_email, default_admin_password, owner_pin, status)
    VALUES (p_company_name, p_subdomain, p_admin_email, p_admin_password, p_owner_pin, 'active')
    RETURNING id INTO v_company_id;
    
    IF v_company_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Failed to create company');
    END IF;

    -- Step 2: Create public user record (linking to existing auth user)
    INSERT INTO public.users (
      auth_user_id,
      email,
      full_name,
      role,
      company_id,
      is_company_admin,
      is_active
    ) VALUES (
      p_auth_user_id,
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

    -- Step 3: Create company settings
    INSERT INTO public.company_settings (company_id, company_name)
    VALUES (v_company_id, p_company_name);

    RETURN json_build_object(
      'success', true,
      'message', 'Company created successfully',
      'company_id', v_company_id,
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