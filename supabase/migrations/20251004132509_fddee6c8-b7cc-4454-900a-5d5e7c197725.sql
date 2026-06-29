-- Drop and recreate the change_team_member_pin function with proper dual-hash verification
DROP FUNCTION IF EXISTS public.change_team_member_pin(uuid, text, text);

CREATE OR REPLACE FUNCTION public.change_team_member_pin(
  p_member_id UUID,
  p_new_pin TEXT,
  p_owner_pin TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
  v_current_user_company_id UUID;
  v_target_member RECORD;
  v_owner_user RECORD;
  v_pin_hash TEXT;
  v_owner_pin_verified BOOLEAN := false;
BEGIN
  -- Get current authenticated user
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get current user's company and role
  SELECT company_id, role, is_owner, is_company_admin, pin_code
  INTO v_current_user_company_id, v_owner_user.role, v_owner_user.is_owner, v_owner_user.is_company_admin, v_owner_user.pin_code
  FROM users
  WHERE auth_user_id = v_current_user_id;

  IF v_current_user_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User company not found');
  END IF;

  -- Get target member details
  SELECT * INTO v_target_member
  FROM users
  WHERE id = p_member_id AND company_id = v_current_user_company_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Team member not found');
  END IF;

  -- If owner PIN is required and provided, verify it
  IF p_owner_pin IS NOT NULL AND p_owner_pin != '' THEN
    -- Try SHA-256 first (new format)
    IF v_owner_user.pin_code = encode(digest(p_owner_pin, 'sha256'), 'hex') THEN
      v_owner_pin_verified := true;
    -- Fall back to MD5 (legacy format)
    ELSIF v_owner_user.pin_code = md5(p_owner_pin || 'pin_salt_2025') THEN
      v_owner_pin_verified := true;
    END IF;

    IF NOT v_owner_pin_verified THEN
      RETURN json_build_object('success', false, 'error', 'Invalid owner PIN');
    END IF;
  END IF;

  -- Generate new hashes
  v_pin_hash := encode(digest(p_new_pin, 'sha256'), 'hex');

  -- Update both pin_code (hashed) and pin_code_encrypted (for retrieval)
  UPDATE users
  SET 
    pin_code = v_pin_hash,
    pin_code_encrypted = encode(
      encrypt(
        p_new_pin::bytea,
        current_setting('app.settings.encryption_key', true)::bytea,
        'aes'
      ),
      'base64'
    ),
    updated_at = now()
  WHERE id = p_member_id;

  RETURN json_build_object(
    'success', true,
    'message', 'PIN updated successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;