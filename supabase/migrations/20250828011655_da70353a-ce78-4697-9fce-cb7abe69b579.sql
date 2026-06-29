-- Fix security issues by updating search_path settings for RPC functions
CREATE OR REPLACE FUNCTION public.set_owner_pin_secure(p_company_id uuid, p_new_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hashed_pin text;
  v_current_user_company_id uuid;
  v_user_role text;
  v_is_company_admin boolean;
BEGIN
  -- Validate PIN format
  IF p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  -- Get current user's company and permissions
  SELECT u.company_id, u.role, u.is_company_admin
  INTO v_current_user_company_id, v_user_role, v_is_company_admin
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  -- Check if user has permission to set owner PIN for this company
  IF v_current_user_company_id != p_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot set owner PIN for another company');
  END IF;

  IF NOT (v_user_role = 'admin' OR v_is_company_admin) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions to set owner PIN');
  END IF;

  -- Hash the PIN using the same salt as authentication
  v_hashed_pin := public.hash_pin_md5(p_new_pin);

  -- Update the company's owner PIN
  UPDATE public.companies
  SET owner_pin = v_hashed_pin,
      updated_at = now()
  WHERE id = p_company_id;

  RETURN json_build_object('success', true, 'message', 'Owner PIN set successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_owner_pin_secure(p_company_id uuid, p_current_pin text, p_new_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stored_pin text;
  v_hashed_current_pin text;
  v_hashed_new_pin text;
  v_current_user_company_id uuid;
  v_user_role text;
  v_is_company_admin boolean;
BEGIN
  -- Validate PIN formats
  IF p_current_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'Current PIN must be exactly 4 digits');
  END IF;

  IF p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'New PIN must be exactly 4 digits');
  END IF;

  -- Get current user's company and permissions
  SELECT u.company_id, u.role, u.is_company_admin
  INTO v_current_user_company_id, v_user_role, v_is_company_admin
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  -- Check if user has permission to update owner PIN for this company
  IF v_current_user_company_id != p_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot update owner PIN for another company');
  END IF;

  IF NOT (v_user_role = 'admin' OR v_is_company_admin) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions to update owner PIN');
  END IF;

  -- Get the stored owner PIN
  SELECT owner_pin INTO v_stored_pin
  FROM public.companies
  WHERE id = p_company_id
  LIMIT 1;

  IF v_stored_pin IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No owner PIN is currently set');
  END IF;

  -- Hash the current PIN for comparison
  v_hashed_current_pin := public.hash_pin_md5(p_current_pin);

  -- Verify current PIN (support both hashed and plaintext for migration)
  IF v_stored_pin != v_hashed_current_pin AND v_stored_pin != p_current_pin THEN
    RETURN json_build_object('success', false, 'error', 'Current PIN is incorrect');
  END IF;

  -- Hash the new PIN
  v_hashed_new_pin := public.hash_pin_md5(p_new_pin);

  -- Update the company's owner PIN
  UPDATE public.companies
  SET owner_pin = v_hashed_new_pin,
      updated_at = now()
  WHERE id = p_company_id;

  RETURN json_build_object('success', true, 'message', 'Owner PIN updated successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;