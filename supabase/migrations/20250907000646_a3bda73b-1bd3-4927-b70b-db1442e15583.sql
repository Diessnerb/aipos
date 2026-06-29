-- Add marketing page permissions to system defaults for new companies
-- Create system_default_permissions table if it doesn't exist with proper constraints

CREATE TABLE IF NOT EXISTS system_default_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_name text NOT NULL,
  access_level text NOT NULL CHECK (access_level IN ('staff', 'manager', 'admin')),
  permission_type text NOT NULL CHECK (permission_type IN ('no_access', 'view', 'growth', 'edit', 'admin')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(page_name, access_level)
);

-- Insert all system default permissions (marketing + core pages)
INSERT INTO system_default_permissions (page_name, access_level, permission_type)
VALUES 
  -- Marketing permissions
  ('marketing', 'staff', 'growth'),
  ('marketing', 'manager', 'growth'),
  ('marketing', 'admin', 'edit'),
  -- Core page permissions  
  ('reservations', 'staff', 'view'),
  ('reservations', 'manager', 'edit'),
  ('reservations', 'admin', 'admin'),
  ('customers', 'staff', 'view'),
  ('customers', 'manager', 'edit'),
  ('customers', 'admin', 'admin'),
  ('menu_items', 'staff', 'view'),
  ('menu_items', 'manager', 'growth'),
  ('menu_items', 'admin', 'edit'),
  ('analytics', 'manager', 'view'),
  ('analytics', 'admin', 'view'),
  ('company_settings', 'admin', 'edit')
ON CONFLICT (page_name, access_level) DO NOTHING;

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
  FROM system_default_permissions
  WHERE permission_type != 'no_access';
  
  RETURN json_build_object('success', true, 'message', 'System defaults applied to new company');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;