-- Fix ambiguous column reference in create_company_with_admin function
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  company_name text,
  company_subdomain text,
  admin_email text,
  admin_password text,
  admin_full_name text,
  owner_pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id uuid;
  new_user_id uuid;
  auth_user_id uuid;
  generated_pin text;
BEGIN
  -- Check if subdomain already exists
  IF EXISTS (SELECT 1 FROM public.companies c WHERE c.subdomain = create_company_with_admin.company_subdomain) THEN
    RETURN json_build_object('success', false, 'error', 'Subdomain already exists');
  END IF;

  -- Check if admin email already exists
  IF EXISTS (SELECT 1 FROM auth.users au WHERE au.email = create_company_with_admin.admin_email) THEN
    RETURN json_build_object('success', false, 'error', 'Admin email already exists');
  END IF;

  -- Check if owner PIN already exists (fix ambiguous column reference)
  IF EXISTS (SELECT 1 FROM public.companies c WHERE c.owner_pin = create_company_with_admin.owner_pin) THEN
    RETURN json_build_object('success', false, 'error', 'Owner PIN already exists');
  END IF;

  -- Create the company
  INSERT INTO public.companies (name, subdomain, default_admin_email, default_admin_password, owner_pin)
  VALUES (company_name, company_subdomain, admin_email, admin_password, owner_pin)
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
    json_build_object('full_name', admin_full_name, 'role', 'admin')
  )
  RETURNING id INTO auth_user_id;

  -- Generate unique PIN for admin user
  generated_pin := public.generate_unique_pin();

  -- Create public user record linked to the company
  INSERT INTO public.users (
    auth_user_id,
    email,
    full_name,
    role,
    company_id,
    is_company_admin,
    pin_code
  ) VALUES (
    auth_user_id,
    admin_email,
    admin_full_name,
    'admin',
    new_company_id,
    true,
    generated_pin
  )
  RETURNING id INTO new_user_id;

  -- Create default tables linked to the company
  INSERT INTO public.tables (company_id, table_number, seats, is_active, accessibility_friendly)
  SELECT 
    new_company_id,
    generate_series(1, 10),
    CASE 
      WHEN generate_series(1, 10) <= 4 THEN 2
      WHEN generate_series(1, 10) <= 8 THEN 4
      ELSE 6
    END,
    true,
    generate_series(1, 10) IN (1, 5) -- Tables 1 and 5 are accessible
  FROM generate_series(1, 10);

  -- Create default menu categories linked to the company
  INSERT INTO public.menu_categories (name, description, company_id, display_order, is_active)
  VALUES 
    ('Starters', 'Appetizers and small plates', new_company_id, 1, true),
    ('Mains', 'Main course dishes', new_company_id, 2, true),
    ('Desserts', 'Sweet treats and desserts', new_company_id, 3, true),
    ('Drinks', 'Beverages and cocktails', new_company_id, 4, true);

  -- Create company settings linked to the company
  INSERT INTO public.company_settings (
    company_id,
    company_name,
    auto_assign_tables
  ) VALUES (
    new_company_id,
    company_name,
    true
  );

  -- Apply system default permissions for the new company
  PERFORM public.apply_system_defaults_to_new_company(new_company_id);

  RETURN json_build_object(
    'success', true,
    'message', 'Company created successfully',
    'company_id', new_company_id,
    'admin_user_id', new_user_id,
    'admin_pin', generated_pin
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;