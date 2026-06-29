-- Simple approach: Create table and insert marketing permissions without conflict handling

-- Create system_default_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_default_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_name text NOT NULL,
  access_level text NOT NULL CHECK (access_level IN ('staff', 'manager', 'admin')),
  permission_type text NOT NULL CHECK (permission_type IN ('no_access', 'view', 'growth', 'edit', 'admin')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'system_default_permissions_page_name_access_level_key'
  ) THEN
    ALTER TABLE system_default_permissions 
    ADD CONSTRAINT system_default_permissions_page_name_access_level_key 
    UNIQUE (page_name, access_level);
  END IF;
END $$;

-- Insert marketing permissions (ignore if already exists)
INSERT INTO system_default_permissions (page_name, access_level, permission_type)
SELECT 'marketing', 'staff', 'growth'
WHERE NOT EXISTS (
  SELECT 1 FROM system_default_permissions 
  WHERE page_name = 'marketing' AND access_level = 'staff'
);

INSERT INTO system_default_permissions (page_name, access_level, permission_type)
SELECT 'marketing', 'manager', 'growth'
WHERE NOT EXISTS (
  SELECT 1 FROM system_default_permissions 
  WHERE page_name = 'marketing' AND access_level = 'manager'
);

INSERT INTO system_default_permissions (page_name, access_level, permission_type)
SELECT 'marketing', 'admin', 'edit'
WHERE NOT EXISTS (
  SELECT 1 FROM system_default_permissions 
  WHERE page_name = 'marketing' AND access_level = 'admin'
);

-- Update apply_system_defaults_to_new_company function
CREATE OR REPLACE FUNCTION public.apply_system_defaults_to_new_company(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if system_default_permissions table exists and has data
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_default_permissions') THEN
    -- Insert from system defaults table
    INSERT INTO page_permissions (page_name, access_level, permission_type, company_id)
    SELECT page_name, access_level, permission_type, p_company_id
    FROM system_default_permissions
    WHERE permission_type != 'no_access';
  ELSE
    -- Fallback: Insert basic defaults if table doesn't exist
    INSERT INTO page_permissions (page_name, access_level, permission_type, company_id)
    VALUES 
      ('reservations', 'staff', 'view', p_company_id),
      ('reservations', 'manager', 'edit', p_company_id),
      ('reservations', 'admin', 'admin', p_company_id),
      ('customers', 'staff', 'view', p_company_id),
      ('customers', 'manager', 'edit', p_company_id),
      ('customers', 'admin', 'admin', p_company_id),
      ('menu_items', 'staff', 'view', p_company_id),
      ('menu_items', 'manager', 'growth', p_company_id),
      ('menu_items', 'admin', 'edit', p_company_id),
      ('marketing', 'staff', 'growth', p_company_id),
      ('marketing', 'manager', 'growth', p_company_id),
      ('marketing', 'admin', 'edit', p_company_id),
      ('analytics', 'manager', 'view', p_company_id),
      ('analytics', 'admin', 'view', p_company_id),
      ('company_settings', 'admin', 'edit', p_company_id);
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'System defaults applied to new company');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;