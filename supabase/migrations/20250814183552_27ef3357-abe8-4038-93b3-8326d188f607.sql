-- Create super admin company deletion function
CREATE OR REPLACE FUNCTION public.delete_company_super_admin(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only super admins can delete companies
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized - only super admins can delete companies');
  END IF;
  
  -- Check if company exists
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RETURN json_build_object('success', false, 'error', 'Company not found');
  END IF;
  
  -- Delete related data in correct order to avoid foreign key constraints
  -- Delete users in the company first
  DELETE FROM public.users WHERE company_id = p_company_id;
  
  -- Delete company settings
  DELETE FROM public.company_settings WHERE company_id = p_company_id;
  
  -- Delete page permissions
  DELETE FROM public.page_permissions WHERE company_id = p_company_id;
  
  -- Delete company permission templates
  DELETE FROM public.company_permission_templates WHERE company_id = p_company_id;
  
  -- Delete locations
  DELETE FROM public.locations WHERE company_id = p_company_id;
  
  -- Delete the company itself
  DELETE FROM public.companies WHERE id = p_company_id;
  
  RETURN json_build_object('success', true, 'message', 'Company and all related data deleted successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Add DELETE RLS policy for companies table to allow super admins
CREATE POLICY "Super admins can delete companies" 
ON public.companies 
FOR DELETE 
USING (public.is_super_admin());