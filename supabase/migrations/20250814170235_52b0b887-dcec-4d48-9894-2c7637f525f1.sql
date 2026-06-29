-- Drop the existing problematic function
DROP FUNCTION IF EXISTS public.create_company_with_admin(text, text, text, text, text);

-- Create new fixed function that doesn't manipulate auth.users directly
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
  unique_pin_generated text;
  pin_exists boolean;
BEGIN
  -- Only super admins can create companies
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Check if subdomain already exists
  IF EXISTS (SELECT 1 FROM public.companies WHERE subdomain = company_subdomain) THEN
    RETURN json_build_object('success', false, 'error', 'Subdomain already exists');
  END IF;
  
  -- Validate owner PIN format
  IF owner_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'Owner PIN must be exactly 4 digits');
  END IF;
  
  -- Check if owner PIN already exists in companies table
  IF EXISTS (SELECT 1 FROM public.companies WHERE owner_pin = owner_pin) THEN
    RETURN json_build_object('success', false, 'error', 'Owner PIN already exists');
  END IF;
  
  -- Generate unique PIN for admin user
  LOOP
    unique_pin_generated := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    
    -- Check if PIN exists in users table or is the same as owner PIN
    SELECT EXISTS(
      SELECT 1 FROM public.users WHERE pin_code = unique_pin_generated
      UNION
      SELECT 1 WHERE unique_pin_generated = owner_pin
    ) INTO pin_exists;
    
    IF NOT pin_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  -- Create the company with owner credentials and PIN
  INSERT INTO public.companies (
    name, 
    subdomain, 
    default_admin_email, 
    default_admin_password,
    owner_pin,
    status
  )
  VALUES (
    company_name, 
    company_subdomain, 
    admin_email, 
    admin_password,
    owner_pin,
    'active'
  ) RETURNING id INTO new_company_id;
  
  -- Create admin user in public.users table (no auth.users manipulation)
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
    unique_pin_generated,
    true
  ) RETURNING id INTO new_user_id;
  
  -- Initialize default company settings
  INSERT INTO public.company_settings (
    company_id,
    company_name,
    timezone,
    auto_assign_tables
  ) VALUES (
    new_company_id,
    company_name,
    'Europe/London',
    false
  );
  
  -- Create default restaurant tables (1-10)
  INSERT INTO public.tables (company_id, table_number, seats, is_active)
  VALUES 
    (new_company_id, 1, 2, true),
    (new_company_id, 2, 2, true),
    (new_company_id, 3, 4, true),
    (new_company_id, 4, 4, true),
    (new_company_id, 5, 4, true),
    (new_company_id, 6, 6, true),
    (new_company_id, 7, 6, true),
    (new_company_id, 8, 6, true),
    (new_company_id, 9, 8, true),
    (new_company_id, 10, 8, true);
  
  -- Create default menu categories
  WITH category_inserts AS (
    INSERT INTO public.menu_categories (company_id, name, description, display_order)
    VALUES 
      (new_company_id, 'Starters', 'Appetizers and small plates', 1),
      (new_company_id, 'Mains', 'Main course dishes', 2),
      (new_company_id, 'Desserts', 'Sweet treats and desserts', 3),
      (new_company_id, 'Drinks', 'Beverages and cocktails', 4)
    RETURNING id, name
  )
  SELECT COUNT(*) FROM category_inserts;
  
  -- Apply default page permissions for the company
  PERFORM public.apply_system_defaults_to_new_company(new_company_id);
  
  RETURN json_build_object(
    'success', true, 
    'company_id', new_company_id,
    'user_id', new_user_id,
    'admin_pin', unique_pin_generated,
    'owner_pin', owner_pin,
    'message', 'Company created successfully with default data'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;