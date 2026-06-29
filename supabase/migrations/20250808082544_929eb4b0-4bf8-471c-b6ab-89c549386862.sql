
-- 1) Fix ambiguous column/variable names in update_company_admin_credentials
CREATE OR REPLACE FUNCTION public.update_company_admin_credentials(
  p_company_id uuid,
  p_new_email text,
  p_new_password text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_user_id uuid;
  v_auth_user_id uuid;
BEGIN
  -- Only super admins can update company admin credentials
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Get the company admin user (disambiguate columns and avoid name collisions)
  SELECT u.id, u.auth_user_id
  INTO v_admin_user_id, v_auth_user_id
  FROM public.users u
  WHERE u.company_id = p_company_id
    AND u.is_company_admin = true
  LIMIT 1;
  
  IF v_admin_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Company admin not found');
  END IF;
  
  -- Update email in public.users
  UPDATE public.users 
  SET email = p_new_email
  WHERE id = v_admin_user_id;
  
  -- Update email/password in auth.users if an auth user exists
  IF v_auth_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET email = p_new_email
    WHERE id = v_auth_user_id;
    
    IF p_new_password IS NOT NULL THEN
      UPDATE auth.users 
      SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
          updated_at = now()
      WHERE id = v_auth_user_id;
    END IF;
  END IF;
  
  -- Update company default credentials
  UPDATE public.companies 
  SET 
    default_admin_email = p_new_email,
    default_admin_password = COALESCE(p_new_password, default_admin_password),
    updated_at = now()
  WHERE id = p_company_id;
  
  RETURN json_build_object('success', true, 'message', 'Admin credentials updated successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- 2) Allow super admins to INSERT into company_settings (needed for default row creation)
DROP POLICY IF EXISTS "Super admins can manage all company settings" ON public.company_settings;

CREATE POLICY "Super admins can manage all company settings"
  ON public.company_settings
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
