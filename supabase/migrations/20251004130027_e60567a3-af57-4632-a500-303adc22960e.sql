-- Drop the old function first
DROP FUNCTION IF EXISTS public.change_team_member_pin(UUID, TEXT, TEXT);

-- Recreate with current user PIN verification
CREATE OR REPLACE FUNCTION public.change_team_member_pin(
  p_member_id UUID,
  p_new_pin TEXT,
  p_current_user_pin TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_current_user_id UUID;
  v_current_user_role TEXT;
  v_current_user_is_owner BOOLEAN;
  v_target_user_role TEXT;
  v_target_user_is_owner BOOLEAN;
  v_company_id UUID;
  v_hashed_pin TEXT;
  v_current_user_hashed_pin TEXT;
BEGIN
  -- Get current authenticated user's public user record
  SELECT id, role, company_id, 
         COALESCE(is_company_admin, false) OR role = 'owner'
  INTO v_current_user_id, v_current_user_role, v_company_id, v_current_user_is_owner
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF v_current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Get target user's role and company
  SELECT role, 
         COALESCE(is_company_admin, false) OR role = 'owner',
         company_id
  INTO v_target_user_role, v_target_user_is_owner, v_company_id
  FROM public.users
  WHERE id = p_member_id;

  IF v_target_user_role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Target user not found');
  END IF;

  -- Verify same company
  IF v_company_id IS NULL OR v_company_id != (SELECT company_id FROM public.users WHERE id = p_member_id) THEN
    RETURN json_build_object('success', false, 'error', 'Users must be in the same company');
  END IF;

  -- Verify current user's PIN
  SELECT pin_code INTO v_current_user_hashed_pin
  FROM public.users
  WHERE id = v_current_user_id;

  IF v_current_user_hashed_pin IS NULL OR v_current_user_hashed_pin != public.hash_pin_md5(p_current_user_pin) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid PIN');
  END IF;

  -- Check hierarchy permissions
  IF v_current_user_is_owner THEN
    -- Owner can change anyone's PIN
    NULL;
  ELSIF v_current_user_role = 'admin' THEN
    IF v_target_user_is_owner OR v_target_user_role = 'admin' THEN
      RETURN json_build_object('success', false, 'error', 'Admins cannot change owner or admin PINs');
    END IF;
  ELSIF v_current_user_role = 'manager' THEN
    IF v_target_user_role != 'staff' THEN
      RETURN json_build_object('success', false, 'error', 'Managers can only change staff PINs');
    END IF;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Hash the new PIN
  v_hashed_pin := public.hash_pin_md5(p_new_pin);

  -- Update the PIN
  UPDATE public.users
  SET pin_code = v_hashed_pin,
      updated_at = now()
  WHERE id = p_member_id;

  RETURN json_build_object('success', true, 'message', 'PIN changed successfully');

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;