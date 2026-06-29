CREATE OR REPLACE FUNCTION public.reactivate_user(user_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only super admins can reactivate users
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Check if user exists and is inactive
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = user_id_param AND is_active = false) THEN
    RETURN json_build_object('success', false, 'error', 'User not found or already active');
  END IF;
  
  -- Reactivate the user
  UPDATE public.users 
  SET 
    is_active = true,
    deleted_at = null
  WHERE id = user_id_param;
  
  RETURN json_build_object('success', true, 'message', 'User reactivated successfully');
END;
$function$;