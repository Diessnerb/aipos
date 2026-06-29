-- Fix the change_team_member_pin function with proper security and digest function support
CREATE OR REPLACE FUNCTION public.change_team_member_pin(
  p_member_id uuid,
  p_new_pin text,
  p_owner_pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_current_user_id uuid;
  v_current_company_id uuid;
  v_current_pin_code text;
  v_current_role text;
  v_current_is_owner boolean;
  v_member_company_id uuid;
  v_member_role text;
  v_member_is_owner boolean;
  v_new_pin_hash text;
  v_owner_pin_sha256 text;
  v_owner_pin_md5 text;
BEGIN
  -- Fetch current user with role info
  SELECT id, company_id, pin_code, role, COALESCE(is_owner, false)
    INTO v_current_user_id, v_current_company_id, v_current_pin_code, v_current_role, v_current_is_owner
  FROM public.users
  WHERE auth_user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF v_current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated or inactive');
  END IF;

  -- Validate new PIN is exactly 4 digits
  IF p_new_pin IS NULL OR length(p_new_pin) <> 4 OR p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  -- Verify the provided owner PIN against stored hash
  v_owner_pin_sha256 := encode(digest(p_owner_pin, 'sha256'), 'hex');
  v_owner_pin_md5 := md5(p_owner_pin || 'pin_salt_2025');

  IF v_current_pin_code IS NULL OR (v_current_pin_code <> v_owner_pin_sha256 AND v_current_pin_code <> v_owner_pin_md5) THEN
    RETURN json_build_object('success', false, 'error', 'Your PIN is incorrect');
  END IF;

  -- Ensure target member exists, active, and fetch their role info
  SELECT company_id, role, COALESCE(is_owner, false)
    INTO v_member_company_id, v_member_role, v_member_is_owner
  FROM public.users
  WHERE id = p_member_id AND is_active = true;

  IF v_member_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Team member not found or inactive');
  END IF;

  IF v_member_company_id <> v_current_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: different company');
  END IF;

  -- Role hierarchy validation
  -- Cannot change own PIN through this interface
  IF v_current_user_id = p_member_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot change your own PIN through this interface');
  END IF;

  -- Cannot change owner PIN unless you are owner
  IF v_member_is_owner AND NOT v_current_is_owner THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: cannot change owner PIN');
  END IF;

  -- Role-based permission checks
  IF NOT v_current_is_owner THEN
    -- Admins can only change manager and staff PINs
    IF v_current_role = 'admin' THEN
      IF v_member_role NOT IN ('manager', 'staff') THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized: admins can only change manager/staff PINs');
      END IF;
    -- Managers can only change staff PINs
    ELSIF v_current_role = 'manager' THEN
      IF v_member_role <> 'staff' THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized: managers can only change staff PINs');
      END IF;
    -- Staff cannot change any PINs
    ELSIF v_current_role = 'staff' THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized: staff cannot change other users'' PINs');
    END IF;
  END IF;

  -- Hash and update new PIN
  v_new_pin_hash := encode(digest(p_new_pin, 'sha256'), 'hex');

  UPDATE public.users
  SET pin_code = v_new_pin_hash,
      updated_at = now()
  WHERE id = p_member_id;

  RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'Failed to update PIN: ' || SQLERRM);
END;
$$;