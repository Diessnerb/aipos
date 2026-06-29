-- Fix the CASE/WHEN error in create_company_with_admin function
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  company_name text,
  company_subdomain text,
  admin_email text,
  admin_password text,
  admin_full_name text,
  owner_pin text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id uuid;
  new_admin_user_id uuid;
BEGIN
  -- Only super admins can create companies
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check if subdomain already exists
  IF EXISTS (SELECT 1 FROM public.companies WHERE subdomain = company_subdomain) THEN
    RETURN json_build_object('success', false, 'error', 'Subdomain already exists');
  END IF;

  -- Check if admin email already exists
  IF EXISTS (SELECT 1 FROM public.users WHERE email = admin_email) THEN
    RETURN json_build_object('success', false, 'error', 'Admin email already exists');
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
    company_name,
    company_subdomain,
    'active',
    admin_email,
    admin_password,
    owner_pin
  ) RETURNING id INTO new_company_id;

  -- Create the admin user in public.users
  INSERT INTO public.users (
    email,
    full_name,
    role,
    company_id,
    is_company_admin,
    is_active
  ) VALUES (
    admin_email,
    admin_full_name,
    'admin',
    new_company_id,
    true,
    true
  ) RETURNING id INTO new_admin_user_id;

  -- Create default tables (1-10) with proper seat assignments and accessibility
  INSERT INTO public.tables (company_id, table_number, table_name, seats, is_active, accessibility_friendly, status)
  SELECT 
    new_company_id,
    table_num,
    'Table ' || table_num,
    CASE 
      WHEN table_num <= 4 THEN 2
      WHEN table_num <= 8 THEN 4
      ELSE 6
    END,
    true,
    table_num IN (1, 5),
    'available'
  FROM generate_series(1, 10) AS table_num;

  -- Create default menu categories
  INSERT INTO public.menu_categories (company_id, name, description, display_order, is_active)
  VALUES 
    (new_company_id, 'Starters', 'Appetizers and light bites', 1, true),
    (new_company_id, 'Mains', 'Main course dishes', 2, true),
    (new_company_id, 'Desserts', 'Sweet treats and desserts', 3, true),
    (new_company_id, 'Drinks', 'Beverages and cocktails', 4, true);

  -- Create default company settings
  INSERT INTO public.company_settings (
    id,
    company_id,
    company_name,
    auto_assign_tables,
    show_allergen_disclaimer
  ) VALUES (
    new_company_id,
    new_company_id,
    company_name,
    false,
    true
  );

  -- Apply system default permissions
  PERFORM public.apply_system_defaults_to_new_company(new_company_id);

  RETURN json_build_object(
    'success', true,
    'message', 'Company created successfully',
    'company_id', new_company_id,
    'admin_user_id', new_admin_user_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;