-- Fix trigger issue first
DROP TRIGGER IF EXISTS track_first_admin_login_trigger ON public.users;
DROP FUNCTION IF EXISTS public.track_first_admin_login();

-- Drop existing function to allow parameter name changes
DROP FUNCTION IF EXISTS public.change_team_member_pin(uuid, text, text);

-- Phase 1: Add is_owner field and backfill
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE;

-- Backfill: Set is_owner = TRUE for company admins whose email matches company default_admin_email
UPDATE public.users u
SET is_owner = TRUE
WHERE u.is_company_admin = TRUE
  AND u.email IN (
    SELECT c.default_admin_email 
    FROM public.companies c 
    WHERE c.id = u.company_id
  );

-- Phase 4: Update get_decrypted_pin to enforce role hierarchy
CREATE OR REPLACE FUNCTION public.get_decrypted_pin(user_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted_pin TEXT;
  v_decrypted_pin TEXT;
  v_target_role TEXT;
  v_target_company_id UUID;
  v_current_user_id UUID;
  v_current_role TEXT;
  v_current_is_owner BOOLEAN;
  v_current_company_id UUID;
BEGIN
  SELECT u.id, u.role, u.is_owner, u.company_id
  INTO v_current_user_id, v_current_role, v_current_is_owner, v_current_company_id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT u.pin_code_encrypted, u.role, u.company_id
  INTO v_encrypted_pin, v_target_role, v_target_company_id
  FROM public.users u
  WHERE u.id = user_id_param;

  IF v_encrypted_pin IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_target_company_id != v_current_company_id THEN
    RAISE EXCEPTION 'Cannot access PIN from different company';
  END IF;

  IF v_current_is_owner THEN
    RETURN public.decrypt_pin(v_encrypted_pin);
  END IF;

  IF v_current_role = 'admin' AND v_target_role IN ('staff', 'manager') THEN
    RETURN public.decrypt_pin(v_encrypted_pin);
  END IF;

  IF v_current_role = 'manager' AND v_target_role = 'staff' THEN
    RETURN public.decrypt_pin(v_encrypted_pin);
  END IF;

  RAISE EXCEPTION 'Insufficient permissions to view this PIN';
END;
$$;

-- Recreate change_team_member_pin with role hierarchy
CREATE FUNCTION public.change_team_member_pin(
  p_user_id UUID,
  p_new_pin TEXT,
  p_owner_pin TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
  v_current_role TEXT;
  v_current_is_owner BOOLEAN;
  v_current_company_id UUID;
  v_target_role TEXT;
  v_target_company_id UUID;
  v_owner_user_id UUID;
  v_hashed_pin TEXT;
  v_encrypted_pin TEXT;
BEGIN
  SELECT u.id, u.role, u.is_owner, u.company_id
  INTO v_current_user_id, v_current_role, v_current_is_owner, v_current_company_id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT u.role, u.company_id
  INTO v_target_role, v_target_company_id
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_target_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Target user not found');
  END IF;

  IF v_target_company_id != v_current_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot change PIN for different company');
  END IF;

  SELECT u.id INTO v_owner_user_id
  FROM public.users u
  WHERE u.company_id = v_current_company_id
    AND u.is_owner = TRUE
    AND u.pin_code = encode(digest(p_owner_pin, 'sha256'), 'hex')
  LIMIT 1;

  IF v_owner_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid owner PIN');
  END IF;

  IF NOT v_current_is_owner THEN
    IF v_current_role = 'admin' AND v_target_role NOT IN ('staff', 'manager') THEN
      RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;

    IF v_current_role = 'manager' AND v_target_role != 'staff' THEN
      RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;

    IF v_current_role = 'staff' THEN
      RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;
  END IF;

  v_hashed_pin := encode(digest(p_new_pin, 'sha256'), 'hex');
  v_encrypted_pin := public.encrypt_pin(p_new_pin);

  UPDATE public.users
  SET pin_code = v_hashed_pin,
      pin_code_encrypted = v_encrypted_pin,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'message', 'PIN changed successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;