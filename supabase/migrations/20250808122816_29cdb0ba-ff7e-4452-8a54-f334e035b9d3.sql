-- Create a function that allows company admins to soft delete users in their company
CREATE OR REPLACE FUNCTION public.soft_delete_company_user(user_id_param uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_company_id uuid;
  target_user_company_id uuid;
  current_user_role text;
  current_user_is_admin boolean;
BEGIN
  -- Get current user's company and role
  SELECT u.company_id, u.role, u.is_company_admin
  INTO current_user_company_id, current_user_role, current_user_is_admin
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
  
  -- Check if user is authenticated
  IF current_user_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated or not linked to a company');
  END IF;
  
  -- Check if current user has admin permissions
  IF NOT (current_user_role = 'admin' OR current_user_is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions. Only admins can remove team members.');
  END IF;
  
  -- Get target user's company
  SELECT u.company_id
  INTO target_user_company_id
  FROM public.users u
  WHERE u.id = user_id_param AND u.is_active = true
  LIMIT 1;
  
  -- Check if target user exists and is active
  IF target_user_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found or already deleted');
  END IF;
  
  -- Check if both users are in the same company
  IF current_user_company_id != target_user_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot remove users from another company');
  END IF;
  
  -- Soft delete the user
  UPDATE public.users 
  SET 
    is_active = false,
    deleted_at = now()
  WHERE id = user_id_param;
  
  RETURN json_build_object('success', true, 'message', 'Team member removed successfully');
END;
$function$;

-- Create a function that allows company admins to reactivate users in their company
CREATE OR REPLACE FUNCTION public.reactivate_company_user(user_id_param uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_company_id uuid;
  target_user_company_id uuid;
  current_user_role text;
  current_user_is_admin boolean;
BEGIN
  -- Get current user's company and role
  SELECT u.company_id, u.role, u.is_company_admin
  INTO current_user_company_id, current_user_role, current_user_is_admin
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
  
  -- Check if user is authenticated
  IF current_user_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated or not linked to a company');
  END IF;
  
  -- Check if current user has admin permissions
  IF NOT (current_user_role = 'admin' OR current_user_is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions. Only admins can reactivate team members.');
  END IF;
  
  -- Get target user's company
  SELECT u.company_id
  INTO target_user_company_id
  FROM public.users u
  WHERE u.id = user_id_param AND u.is_active = false
  LIMIT 1;
  
  -- Check if target user exists and is inactive
  IF target_user_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found or already active');
  END IF;
  
  -- Check if both users are in the same company
  IF current_user_company_id != target_user_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot reactivate users from another company');
  END IF;
  
  -- Reactivate the user
  UPDATE public.users 
  SET 
    is_active = true,
    deleted_at = null
  WHERE id = user_id_param;
  
  RETURN json_build_object('success', true, 'message', 'Team member reactivated successfully');
END;
$function$;