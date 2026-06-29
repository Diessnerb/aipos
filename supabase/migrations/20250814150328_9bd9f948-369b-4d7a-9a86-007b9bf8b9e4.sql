-- Fix the load_company_permission_template function to use proper enum casting
CREATE OR REPLACE FUNCTION public.load_company_permission_template(p_template_id uuid, p_company_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      (v_permission_record->>'access_level')::access_level,
      (v_permission_record->>'permission_type')::permission_type,
      v_company_id
    );
  END LOOP;
  
  RETURN json_build_object('success', true, 'message', 'Template loaded successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;