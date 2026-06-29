-- Create function to update user PIN
CREATE OR REPLACE FUNCTION public.update_user_pin(
  p_user_id uuid,
  p_new_pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only super admins can update user PINs
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Validate PIN format
  IF p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;
  
  -- Check if PIN already exists for another user
  IF EXISTS (SELECT 1 FROM public.users WHERE pin_code = p_new_pin AND id != p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'PIN already exists');
  END IF;
  
  -- Update the PIN
  UPDATE public.users 
  SET pin_code = p_new_pin
  WHERE id = p_user_id;
  
  RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
END;
$function$;