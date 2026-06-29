-- Create RPC function for superadmins to update company names
CREATE OR REPLACE FUNCTION public.update_company_name(p_company_id uuid, p_new_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only super admins can update company names
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Check if company exists
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RETURN json_build_object('success', false, 'error', 'Company not found');
  END IF;
  
  -- Update the company name
  UPDATE public.companies 
  SET 
    name = p_new_name,
    updated_at = now()
  WHERE id = p_company_id;
  
  -- Also update company_settings.company_name for consistency
  UPDATE public.company_settings
  SET 
    company_name = p_new_name,
    updated_at = now()
  WHERE id = p_company_id;
  
  RETURN json_build_object('success', true, 'message', 'Company name updated successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;