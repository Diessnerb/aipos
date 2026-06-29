-- Create secure RPC function to get company settings by owner PIN
CREATE OR REPLACE FUNCTION public.get_company_assignment_settings_by_owner(p_owner_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_company_name text;
  v_settings_record record;
  v_result json;
BEGIN
  -- Verify owner PIN and get company
  SELECT id, name INTO v_company_id, v_company_name
  FROM public.companies
  WHERE owner_pin = p_owner_pin
    AND status = 'active'
  LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid owner PIN');
  END IF;
  
  -- Get company settings (bypasses RLS as this is a SECURITY DEFINER function)
  SELECT * INTO v_settings_record
  FROM public.company_settings
  WHERE company_id = v_company_id
  LIMIT 1;
  
  -- If no settings exist, create default settings
  IF v_settings_record IS NULL THEN
    INSERT INTO public.company_settings (
      company_id,
      auto_assign_tables,
      optimization_enabled,
      optimization_mode
    ) VALUES (
      v_company_id,
      false,
      false,
      'disabled'
    )
    RETURNING * INTO v_settings_record;
  END IF;
  
  -- Build the result JSON
  v_result := json_build_object(
    'success', true,
    'company_name', v_company_name,
    'settings', row_to_json(v_settings_record)
  );
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;