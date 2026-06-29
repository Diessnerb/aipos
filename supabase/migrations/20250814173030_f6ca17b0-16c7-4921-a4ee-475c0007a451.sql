-- Comprehensive fix for company creation errors

-- Step 1: Add missing updated_at column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Add trigger to automatically update the timestamp
CREATE OR REPLACE FUNCTION public.update_users_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at_trigger ON public.users;
CREATE TRIGGER update_users_updated_at_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_users_updated_at();

-- Step 2: Add RLS policy to allow SECURITY DEFINER functions to insert users
CREATE POLICY "Allow security definer functions to insert users" ON public.users
FOR INSERT WITH CHECK (true);

-- Step 3: Create simplified company creation function without auth manipulation
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
  generated_pin text;
BEGIN
  -- Only super admins can create companies
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check if subdomain already exists
  IF EXISTS (SELECT 1 FROM public.companies c WHERE c.subdomain = create_company_with_admin.company_subdomain) THEN
    RETURN json_build_object('success', false, 'error', 'Subdomain already exists');
  END IF;

  -- Check if owner PIN already exists
  IF EXISTS (SELECT 1 FROM public.companies c WHERE c.owner_pin = create_company_with_admin.owner_pin) THEN
    RETURN json_build_object('success', false, 'error', 'Owner PIN already exists');
  END IF;

  -- Create the company
  INSERT INTO public.companies (name, subdomain, default_admin_email, default_admin_password, owner_pin, status)
  VALUES (company_name, company_subdomain, admin_email, admin_password, owner_pin, 'active')
  RETURNING id INTO new_company_id;

  -- Generate unique PIN for admin user
  generated_pin := public.generate_unique_pin();

  -- Create public user record (no auth user creation)
  INSERT INTO public.users (
    email,
    full_name,
    role,
    company_id,
    is_company_admin,
    pin_code,
    is_active
  ) VALUES (
    admin_email,
    admin_full_name,
    'admin',
    new_company_id,
    true,
    generated_pin,
    true
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

-- Step 4: Fix the cross-company query function to use updated_at column
CREATE OR REPLACE FUNCTION public.get_all_users_cross_company()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  -- Only super admins can access this
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;
  
  SELECT json_agg(
    json_build_object(
      'id', u.id,
      'full_name', u.full_name,
      'email', u.email,
      'role', u.role,
      'is_company_admin', u.is_company_admin,
      'is_active', u.is_active,
      'company_id', u.company_id,
      'company_name', c.name,
      'pin_code', u.pin_code,
      'created_at', u.created_at,
      'updated_at', COALESCE(u.updated_at, u.created_at),
      'last_login', au.last_sign_in_at,
      'remaining_holiday_days', COALESCE(u.remaining_holiday_days, 25)
    )
  ) INTO result
  FROM public.users u
  LEFT JOIN public.companies c ON u.company_id = c.id
  LEFT JOIN auth.users au ON u.auth_user_id = au.id
  ORDER BY u.created_at DESC;
  
  RETURN COALESCE(result, '[]'::json);
END;
$function$;