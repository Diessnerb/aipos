-- Create system default permissions table for super admin managed defaults
CREATE TABLE IF NOT EXISTS public.system_default_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_name TEXT NOT NULL,
  access_level TEXT NOT NULL CHECK (access_level IN ('staff', 'manager', 'admin')),
  permission_type TEXT NOT NULL CHECK (permission_type IN ('no_access', 'view', 'growth', 'edit', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(page_name, access_level)
);

-- Create company permission templates table for company-specific templates
CREATE TABLE IF NOT EXISTS public.company_permission_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  template_name TEXT NOT NULL,
  template_data JSONB NOT NULL, -- Store the permission configuration as JSON
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, template_name)
);

-- Enable RLS on both tables
ALTER TABLE public.system_default_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_permission_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for system_default_permissions (super admin only)
CREATE POLICY "Super admins can manage system default permissions"
ON public.system_default_permissions
FOR ALL
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- RLS policies for company_permission_templates (company-specific access)
CREATE POLICY "Company admins can manage their company templates"
ON public.company_permission_templates
FOR ALL
TO authenticated
USING (
  company_id = get_user_company_safe() AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'manager')
    AND is_company_admin = true
  )
)
WITH CHECK (
  company_id = get_user_company_safe() AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'manager')
    AND is_company_admin = true
  )
);

CREATE POLICY "Company users can view their company templates"
ON public.company_permission_templates
FOR SELECT
TO authenticated
USING (company_id = get_user_company_safe());

-- Create functions for template management
CREATE OR REPLACE FUNCTION public.save_company_permission_template(
  p_template_name TEXT,
  p_company_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_template_data JSONB;
  v_result JSON;
BEGIN
  -- Get company ID (use parameter or derive from current user)
  v_company_id := COALESCE(p_company_id, get_user_company_safe());
  
  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No company ID found');
  END IF;
  
  -- Get current permissions for the company
  SELECT json_agg(
    json_build_object(
      'page_name', page_name,
      'access_level', access_level,
      'permission_type', permission_type
    )
  ) INTO v_template_data
  FROM page_permissions
  WHERE company_id = v_company_id;
  
  -- Insert or update the template
  INSERT INTO company_permission_templates (company_id, template_name, template_data, created_by)
  VALUES (v_company_id, p_template_name, v_template_data, auth.uid())
  ON CONFLICT (company_id, template_name)
  DO UPDATE SET 
    template_data = EXCLUDED.template_data,
    updated_at = now();
  
  RETURN json_build_object('success', true, 'message', 'Template saved successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.load_company_permission_template(
  p_template_id UUID,
  p_company_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_template_data JSONB;
  v_permission_record JSONB;
BEGIN
  -- Get company ID (use parameter or derive from current user)
  v_company_id := COALESCE(p_company_id, get_user_company_safe());
  
  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No company ID found');
  END IF;
  
  -- Get the template data
  SELECT template_data INTO v_template_data
  FROM company_permission_templates
  WHERE id = p_template_id AND company_id = v_company_id;
  
  IF v_template_data IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Template not found');
  END IF;
  
  -- Clear existing permissions for the company
  DELETE FROM page_permissions WHERE company_id = v_company_id;
  
  -- Insert permissions from template
  FOR v_permission_record IN SELECT * FROM jsonb_array_elements(v_template_data)
  LOOP
    INSERT INTO page_permissions (page_name, access_level, permission_type, company_id)
    VALUES (
      v_permission_record->>'page_name',
      (v_permission_record->>'access_level')::TEXT,
      (v_permission_record->>'permission_type')::TEXT,
      v_company_id
    );
  END LOOP;
  
  RETURN json_build_object('success', true, 'message', 'Template loaded successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_to_system_defaults(
  p_company_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  
  -- Insert system default permissions
  INSERT INTO page_permissions (page_name, access_level, permission_type, company_id)
  SELECT page_name, access_level, permission_type, v_company_id
  FROM system_default_permissions;
  
  RETURN json_build_object('success', true, 'message', 'Reset to system defaults successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_system_defaults_to_new_company(
  p_company_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Create trigger to automatically update updated_at timestamps
CREATE TRIGGER update_system_default_permissions_updated_at
  BEFORE UPDATE ON public.system_default_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER update_company_permission_templates_updated_at
  BEFORE UPDATE ON public.company_permission_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamp();