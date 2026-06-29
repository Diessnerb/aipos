-- Drop and recreate system_default_permissions table with correct types
DROP TABLE IF EXISTS system_default_permissions;

CREATE TABLE system_default_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_name text NOT NULL,
  access_level access_level NOT NULL,
  permission_type permission_type NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Insert the system default permissions based on the user's screenshot
INSERT INTO system_default_permissions (page_name, access_level, permission_type) VALUES
  -- Reservations
  ('Reservations', 'staff', 'growth'),
  ('Reservations', 'manager', 'edit'),
  ('Reservations', 'admin', 'edit'),
  
  -- Customers  
  ('Customers', 'staff', 'growth'),
  ('Customers', 'manager', 'edit'),
  ('Customers', 'admin', 'edit'),
  
  -- Menu Items
  ('Menu Items', 'staff', 'growth'),
  ('Menu Items', 'manager', 'growth'),
  ('Menu Items', 'admin', 'edit'),
  
  -- Analytics
  ('Analytics', 'staff', 'growth'),
  ('Analytics', 'manager', 'growth'),
  ('Analytics', 'admin', 'edit'),
  
  -- Company Settings
  ('Company Settings', 'staff', 'no_access'),
  ('Company Settings', 'manager', 'no_access'),
  ('Company Settings', 'admin', 'no_access');

-- Update the reset_to_system_defaults function to work with correct types
CREATE OR REPLACE FUNCTION public.reset_to_system_defaults(p_company_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id UUID;
BEGIN
  -- Get company ID (use parameter or derive from current user)
  v_company_id := COALESCE(p_company_id, get_user_company_safe());
  
  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No company ID found');
  END IF;
  
  -- Clear existing permissions for the company
  DELETE FROM page_permissions WHERE company_id = v_company_id;
  
  -- Insert system default permissions (no casting needed now)
  INSERT INTO page_permissions (page_name, access_level, permission_type, company_id)
  SELECT page_name, access_level, permission_type, v_company_id
  FROM system_default_permissions;
  
  RETURN json_build_object('success', true, 'message', 'Reset to system defaults successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Update the apply_system_defaults_to_new_company function
CREATE OR REPLACE FUNCTION public.apply_system_defaults_to_new_company(p_company_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert system default permissions for new company
  INSERT INTO page_permissions (page_name, access_level, permission_type, company_id)
  SELECT page_name, access_level, permission_type, p_company_id
  FROM system_default_permissions;
  
  RETURN json_build_object('success', true, 'message', 'System defaults applied to new company');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Create trigger to automatically apply defaults to new companies
CREATE OR REPLACE FUNCTION public.apply_defaults_to_new_company()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Apply system defaults when a new company is created
  PERFORM public.apply_system_defaults_to_new_company(NEW.id);
  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_apply_defaults_to_new_company ON companies;
CREATE TRIGGER trigger_apply_defaults_to_new_company
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION apply_defaults_to_new_company();