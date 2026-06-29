-- Add soft delete fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create index for performance on active users queries
CREATE INDEX idx_users_active ON public.users(is_active) WHERE is_active = true;

-- Update the authenticate_by_pin function to only allow active users
CREATE OR REPLACE FUNCTION public.authenticate_by_pin(pin_input text)
RETURNS TABLE(user_id uuid, email text, full_name text, role text, company_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Validate PIN format
  IF pin_input !~ '^[0-9]{4}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.role,
    u.company_id
  FROM users u
  WHERE u.pin_code = pin_input 
    AND u.is_active = true
  LIMIT 1;
END;
$function$;

-- Create function to soft delete a user
CREATE OR REPLACE FUNCTION public.soft_delete_user(user_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create function to reactivate a user
CREATE OR REPLACE FUNCTION public.reactivate_user(user_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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