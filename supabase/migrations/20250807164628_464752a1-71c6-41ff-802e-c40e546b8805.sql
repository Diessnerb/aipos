-- Add the missing create_company_with_admin function that was referenced but not created
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  company_name text,
  company_subdomain text,
  admin_email text,
  admin_password text,
  admin_full_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  new_user_id uuid;
  auth_user_id uuid;
BEGIN
  -- Only super admins can create companies
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Check if subdomain already exists
  IF EXISTS (SELECT 1 FROM public.companies WHERE subdomain = company_subdomain) THEN
    RETURN json_build_object('success', false, 'error', 'Subdomain already exists');
  END IF;
  
  -- Create the company
  INSERT INTO public.companies (name, subdomain, default_admin_email, default_admin_password)
  VALUES (company_name, company_subdomain, admin_email, admin_password)
  RETURNING id INTO new_company_id;
  
  -- Create auth user
  INSERT INTO auth.users (
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data
  ) VALUES (
    admin_email,
    crypt(admin_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    json_build_object('full_name', admin_full_name)
  ) RETURNING id INTO auth_user_id;
  
  -- Create user in public schema
  INSERT INTO public.users (
    auth_user_id,
    email,
    full_name,
    role,
    company_id,
    is_company_admin
  ) VALUES (
    auth_user_id,
    admin_email,
    admin_full_name,
    'admin',
    new_company_id,
    true
  ) RETURNING id INTO new_user_id;
  
  RETURN json_build_object(
    'success', true, 
    'company_id', new_company_id,
    'user_id', new_user_id,
    'message', 'Company and admin user created successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;