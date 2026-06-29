-- Create function to update company admin credentials
CREATE OR REPLACE FUNCTION public.update_company_admin_credentials(
  p_company_id uuid,
  p_new_email text,
  p_new_password text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  admin_user_id uuid;
  auth_user_id uuid;
BEGIN
  -- Only super admins can update company admin credentials
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Get the company admin user
  SELECT id, auth_user_id INTO admin_user_id, auth_user_id
  FROM public.users 
  WHERE company_id = p_company_id AND is_company_admin = true
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Company admin not found');
  END IF;
  
  -- Update email in public.users
  UPDATE public.users 
  SET email = p_new_email
  WHERE id = admin_user_id;
  
  -- Update email in auth.users if auth_user_id exists
  IF auth_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET email = p_new_email
    WHERE id = auth_user_id;
    
    -- Update password if provided
    IF p_new_password IS NOT NULL THEN
      UPDATE auth.users 
      SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
      WHERE id = auth_user_id;
    END IF;
  END IF;
  
  -- Update company default credentials
  UPDATE public.companies 
  SET 
    default_admin_email = p_new_email,
    default_admin_password = COALESCE(p_new_password, default_admin_password)
  WHERE id = p_company_id;
  
  RETURN json_build_object('success', true, 'message', 'Admin credentials updated successfully');
END;
$function$;