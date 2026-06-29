-- Fix invite_team_member_with_pin to use properly qualified digest function
CREATE OR REPLACE FUNCTION public.invite_team_member_with_pin(
  p_email TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_pin TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_new_user_id UUID;
  v_pin_hash TEXT;
  v_pin_encrypted TEXT;
BEGIN
  -- Validate PIN format
  IF p_pin !~ '^\d{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  -- Get the requesting user's company_id
  SELECT company_id INTO v_company_id
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated or no company association');
  END IF;

  -- Check if PIN is already in use within the company
  -- FIX: Use extensions.digest() with proper bytea conversion
  v_pin_hash := encode(extensions.digest(convert_to(p_pin, 'UTF8'), 'sha256'), 'hex');
  
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE company_id = v_company_id AND pin_code = v_pin_hash AND is_active = true
  ) THEN
    RETURN json_build_object('success', false, 'error', 'PIN is already in use');
  END IF;

  -- Encrypt the PIN
  v_pin_encrypted := public.encrypt_pin(p_pin);

  -- Insert the new user with both hashed and encrypted PIN
  INSERT INTO public.users (
    email,
    full_name,
    role,
    company_id,
    pin_code,
    pin_code_encrypted,
    auth_user_id,
    is_active
  ) VALUES (
    p_email,
    p_full_name,
    p_role,
    v_company_id,
    v_pin_hash,
    v_pin_encrypted,
    NULL,
    true
  )
  RETURNING id INTO v_new_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Team member added successfully',
    'user_id', v_new_user_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'User with this email or PIN already exists');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;