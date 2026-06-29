-- Create the create_company_with_admin function that the Edge Function is calling
DROP FUNCTION IF EXISTS public.create_company_with_admin(p_company_name text, p_subdomain text, p_admin_email text, p_admin_password text, p_admin_full_name text, p_owner_pin text, p_auth_user_id uuid);
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  p_company_name text,
  p_subdomain text,
  p_admin_email text,
  p_admin_password text,
  p_admin_full_name text,
  p_owner_pin text,
  p_auth_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
BEGIN
  -- Create the company
  INSERT INTO public.companies (
    name,
    subdomain,
    default_admin_email,
    default_admin_password,
    owner_pin,
    status
  ) VALUES (
    p_company_name,
    p_subdomain,
    p_admin_email,
    p_admin_password,
    p_owner_pin,
    'active'
  )
  RETURNING id INTO v_company_id;

  -- Create the public.users record linked to the auth user
  INSERT INTO public.users (
    auth_user_id,
    email,
    full_name,
    role,
    company_id,
    is_company_admin
  ) VALUES (
    p_auth_user_id,
    p_admin_email,
    p_admin_full_name,
    'admin',
    v_company_id,
    true
  )
  RETURNING id INTO v_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Company and admin user created successfully',
    'company_id', v_company_id,
    'user_id', v_user_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;