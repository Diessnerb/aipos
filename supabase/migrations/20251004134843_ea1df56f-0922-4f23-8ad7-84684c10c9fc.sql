-- Enable pgcrypto extension for digest() and encrypt() functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fix change_team_member_pin with proper bytea type casting
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
  v_current_role text;
  v_current_is_owner boolean;
  v_current_is_company_admin boolean;
  v_current_pin_code text;
  
  v_member_company_id uuid;
  v_member_role text;
  v_member_is_owner boolean;
  v_member_is_company_admin boolean;
  
  v_sha256_hash text;
  v_md5_hash text;
  v_pin_match boolean := false;
  v_new_pin_sha256 text;
  v_encryption_key text;
BEGIN
  -- Get current user info
  SELECT id, company_id, role, is_owner, is_company_admin, pin_code
  INTO v_current_user_id, v_current_company_id, v_current_role, v_current_is_owner, v_current_is_company_admin, v_current_pin_code
  FROM public.users
  WHERE auth_user_id = auth.uid() AND is_active = true;

  IF v_current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Current user not found or inactive');
  END IF;

  -- Verify owner PIN against both hash types (with explicit bytea casting)
  v_sha256_hash := encode(digest(p_owner_pin::text::bytea, 'sha256'), 'hex');
  v_md5_hash := md5(p_owner_pin || 'pin_salt_2025');
  
  IF v_current_pin_code = v_sha256_hash OR v_current_pin_code = v_md5_hash THEN
    v_pin_match := true;
  END IF;

  IF NOT v_pin_match THEN
    RETURN json_build_object('success', false, 'error', 'Invalid PIN verification');
  END IF;

  -- Get member info
  SELECT company_id, role, is_owner, is_company_admin
  INTO v_member_company_id, v_member_role, v_member_is_owner, v_member_is_company_admin
  FROM public.users
  WHERE id = p_member_id AND is_active = true;

  IF v_member_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Team member not found or inactive');
  END IF;

  -- Company isolation
  IF v_current_company_id != v_member_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: different company');
  END IF;

  -- Role hierarchy check
  IF v_member_is_owner OR v_member_is_company_admin THEN
    IF NOT (v_current_is_owner OR v_current_is_company_admin) THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized: cannot change admin/owner PIN');
    END IF;
  ELSIF v_member_role = 'admin' THEN
    IF NOT (v_current_is_owner OR v_current_is_company_admin OR v_current_role = 'admin') THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized: insufficient role');
    END IF;
  ELSIF v_member_role = 'manager' THEN
    IF v_current_role NOT IN ('owner', 'admin', 'manager') AND NOT (v_current_is_owner OR v_current_is_company_admin) THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized: insufficient role');
    END IF;
  END IF;

  -- Hash new PIN with SHA-256 (with explicit bytea casting)
  v_new_pin_sha256 := encode(digest(p_new_pin::text::bytea, 'sha256'), 'hex');

  -- Try to get encryption key (may not exist)
  BEGIN
    v_encryption_key := current_setting('app.settings.encryption_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_encryption_key := NULL;
  END;

  -- Update pin_code (hashed) and pin_code_encrypted (if key exists)
  IF v_encryption_key IS NOT NULL AND v_encryption_key != '' THEN
    UPDATE public.users
    SET 
      pin_code = v_new_pin_sha256,
      pin_code_encrypted = encode(
        encrypt(
          p_new_pin::text::bytea,
          v_encryption_key::bytea,
          'aes'
        ),
        'base64'
      ),
      updated_at = now()
    WHERE id = p_member_id;
  ELSE
    -- No encryption key, only update hashed PIN
    UPDATE public.users
    SET 
      pin_code = v_new_pin_sha256,
      updated_at = now()
    WHERE id = p_member_id;
  END IF;

  RAISE LOG 'PIN changed successfully for member: %, by user: %', p_member_id, v_current_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'PIN updated successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in change_team_member_pin: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', 'Failed to update PIN: ' || SQLERRM);
END;
$$;