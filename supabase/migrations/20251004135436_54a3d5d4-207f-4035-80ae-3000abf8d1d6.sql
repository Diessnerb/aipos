-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Replace with a simple, secure implementation
DROP FUNCTION IF EXISTS public.change_team_member_pin(uuid, text, text);

CREATE OR REPLACE FUNCTION public.change_team_member_pin(
  p_member_id uuid,
  p_new_pin text,
  p_owner_pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid;
  v_current_company_id uuid;
  v_current_pin_code text;
  v_member_company_id uuid;
  v_new_pin_hash text;
  v_owner_pin_sha256 text;
  v_owner_pin_md5 text;
BEGIN
  -- Fetch current user mapped to auth.uid()
  SELECT id, company_id, pin_code
    INTO v_current_user_id, v_current_company_id, v_current_pin_code
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

  -- Verify the provided owner PIN against stored hash (support sha256 and legacy md5+salt)
  v_owner_pin_sha256 := encode(digest(convert_to(p_owner_pin, 'UTF8'), 'sha256'::text), 'hex');
  v_owner_pin_md5 := md5(p_owner_pin || 'pin_salt_2025');

  IF v_current_pin_code IS NULL OR (v_current_pin_code <> v_owner_pin_sha256 AND v_current_pin_code <> v_owner_pin_md5) THEN
    RETURN json_build_object('success', false, 'error', 'Your PIN is incorrect');
  END IF;

  -- Ensure target member exists, active, and in same company
  SELECT company_id INTO v_member_company_id
  FROM public.users
  WHERE id = p_member_id AND is_active = true;

  IF v_member_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Team member not found or inactive');
  END IF;

  IF v_member_company_id <> v_current_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: different company');
  END IF;

  -- Hash and update new PIN (sha256 hex)
  v_new_pin_hash := encode(digest(convert_to(p_new_pin, 'UTF8'), 'sha256'::text), 'hex');

  UPDATE public.users
  SET pin_code = v_new_pin_hash,
      updated_at = now()
  WHERE id = p_member_id;

  RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'Failed to update PIN: ' || SQLERRM);
END;
$$;