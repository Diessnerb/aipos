-- Add marketing page permissions to system defaults for new companies
-- This ensures new companies automatically get marketing permissions

-- First, check if system_default_permissions table exists, if not create it
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_default_permissions') THEN
    CREATE TABLE system_default_permissions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      page_name text NOT NULL,
      access_level text NOT NULL CHECK (access_level IN ('staff', 'manager', 'admin')),
      permission_type text NOT NULL CHECK (permission_type IN ('no_access', 'view', 'growth', 'edit', 'admin')),
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      UNIQUE(page_name, access_level)
    );
  END IF;
END $$;

-- Insert marketing permissions into system defaults (using UPSERT to avoid duplicates)

-- Injected unique constraint for ON CONFLICT by repair script
-- Delete duplicate rows before adding constraint to avoid unique violation
DELETE FROM public.system_default_permissions a USING public.system_default_permissions b WHERE a.ctid < b.ctid AND a.page_name = b.page_name AND a.access_level = b.access_level;
ALTER TABLE public.system_default_permissions DROP CONSTRAINT IF EXISTS uniq_system_default_permissions_page_name_access_level;
ALTER TABLE public.system_default_permissions ADD CONSTRAINT uniq_system_default_permissions_page_name_access_level UNIQUE (page_name,access_level);

INSERT INTO system_default_permissions (page_name, access_level, permission_type)
VALUES 
  ('marketing', 'staff', 'growth'),
  ('marketing', 'manager', 'growth'),
  ('marketing', 'admin', 'edit')
ON CONFLICT (page_name, access_level) 
DO UPDATE SET 
  permission_type = EXCLUDED.permission_type,
  updated_at = now();

-- Also ensure other core pages are in system defaults for completeness
INSERT INTO system_default_permissions (page_name, access_level, permission_type)
VALUES 
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
ON CONFLICT (page_name, access_level) 
DO UPDATE SET 
  permission_type = EXCLUDED.permission_type,
  updated_at = now();

-- Update the apply_system_defaults_to_new_company function to handle the new structure
CREATE OR REPLACE FUNCTION public.apply_system_defaults_to_new_company(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert system default permissions for new company (only non-no_access entries)
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