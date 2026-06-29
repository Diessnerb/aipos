CREATE OR REPLACE FUNCTION public.soft_delete_user(user_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only super admins can soft delete users
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Check if user exists and is active
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = user_id_param AND is_active = true) THEN
    RETURN json_build_object('success', false, 'error', 'User not found or already deleted');
  END IF;
  
  -- Soft delete the user
  UPDATE public.users 
  SET 
    is_active = false,
    deleted_at = now()
  WHERE id = user_id_param;
  
  RETURN json_build_object('success', true, 'message', 'User soft deleted successfully');
END;
$function$;