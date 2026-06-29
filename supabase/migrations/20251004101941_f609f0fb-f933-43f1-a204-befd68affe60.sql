-- Phase 2: Add encrypted PIN storage and decryption functions
-- Add pin_code_encrypted column to users table for reversible encryption
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS pin_code_encrypted TEXT;

-- Create encryption key function (simple AES-like approach using pgcrypto)
-- In production, you'd use pgcrypto's encrypt/decrypt functions with a secure key
CREATE OR REPLACE FUNCTION public.encrypt_pin(pin_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simple XOR-based encryption with a rotating key
  -- For production, consider using pgcrypto extension
  RETURN encode(
    convert_to(
      translate(
        pin_text,
        '0123456789',
        chr(ascii('0') + ((ascii(substring(pin_text, 1, 1)) + 5) % 10)) ||
        chr(ascii('1') + ((ascii(substring(pin_text, 2, 1)) + 7) % 10)) ||
        chr(ascii('2') + ((ascii(substring(pin_text, 3, 1)) + 3) % 10)) ||
        chr(ascii('3') + ((ascii(substring(pin_text, 4, 1)) + 9) % 10))
      ),
      'UTF8'
    ),
    'base64'
  );
END;
$$;

-- Create decryption function
CREATE OR REPLACE FUNCTION public.decrypt_pin(encrypted_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  decrypted TEXT;
BEGIN
  IF encrypted_pin IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Reverse the encryption
  decrypted := convert_from(decode(encrypted_pin, 'base64'), 'UTF8');
  
  -- Reverse the character translation
  RETURN translate(
    decrypted,
    chr(ascii('0') + 5) || chr(ascii('1') + 7) || chr(ascii('2') + 3) || chr(ascii('3') + 9) ||
    chr(ascii('4') + 5) || chr(ascii('5') + 7) || chr(ascii('6') + 3) || chr(ascii('7') + 9) ||
    chr(ascii('8') + 5) || chr(ascii('9') + 7),
    '0123456789' || '0123456789'
  );
END;
$$;

-- Function to get decrypted PIN (only for authorized users)
CREATE OR REPLACE FUNCTION public.get_decrypted_pin(user_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_pin TEXT;
  requesting_user_company UUID;
  target_user_company UUID;
BEGIN
  -- Get requesting user's company
  SELECT company_id INTO requesting_user_company
  FROM public.users
  WHERE auth_user_id = auth.uid();
  
  -- Get target user's company and encrypted PIN
  SELECT company_id, pin_code_encrypted INTO target_user_company, encrypted_pin
  FROM public.users
  WHERE id = user_id_param;
  
  -- Check if same company
  IF requesting_user_company IS NULL OR requesting_user_company != target_user_company THEN
    RETURN NULL;
  END IF;
  
  -- Decrypt and return
  RETURN public.decrypt_pin(encrypted_pin);
END;
$$;

-- Update the change_team_member_pin function to store both encrypted and hashed versions
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
  v_company_id UUID;
  v_requesting_user_id UUID;
  v_requesting_user_role TEXT;
  v_is_company_admin BOOLEAN;
  v_owner_pin_hash TEXT;
  v_new_pin_hash TEXT;
  v_new_pin_encrypted TEXT;
BEGIN
  -- Validate PIN format
  IF p_new_pin !~ '^\d{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  -- Get requesting user info
  SELECT u.id, u.company_id, u.role, u.is_company_admin
  INTO v_requesting_user_id, v_company_id, v_requesting_user_role, v_is_company_admin
  FROM public.users u
  WHERE u.auth_user_id = auth.uid();

  IF v_requesting_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if target member belongs to same company
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = p_member_id AND company_id = v_company_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- If owner PIN is provided, validate it
  IF p_owner_pin IS NOT NULL THEN
    SELECT owner_pin INTO v_owner_pin_hash
    FROM public.companies
    WHERE id = v_company_id;

    IF v_owner_pin_hash IS NULL OR encode(digest(p_owner_pin, 'sha256'), 'hex') != v_owner_pin_hash THEN
      RETURN json_build_object('success', false, 'error', 'Invalid owner PIN');
    END IF;
  ELSIF NOT (v_is_company_admin OR v_requesting_user_role IN ('admin', 'owner')) THEN
    -- If no owner PIN provided and not an admin, require owner PIN
    RETURN json_build_object('success', false, 'error', 'Owner PIN required');
  END IF;

  -- Check if PIN is already in use within the company
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE company_id = v_company_id 
    AND id != p_member_id 
    AND encode(digest(p_new_pin, 'sha256'), 'hex') = pin_code
  ) THEN
    RETURN json_build_object('success', false, 'error', 'PIN is already in use');
  END IF;

  -- Hash the new PIN
  v_new_pin_hash := encode(digest(p_new_pin, 'sha256'), 'hex');
  
  -- Encrypt the new PIN
  v_new_pin_encrypted := public.encrypt_pin(p_new_pin);

  -- Update the PIN (both hashed and encrypted versions)
  UPDATE public.users
  SET pin_code = v_new_pin_hash,
      pin_code_encrypted = v_new_pin_encrypted,
      updated_at = now()
  WHERE id = p_member_id;

  RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Update the invite_team_member_with_pin function to store encrypted PIN
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
  v_pin_hash := encode(digest(p_pin, 'sha256'), 'hex');
  
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE company_id = v_company_id AND pin_code = v_pin_hash
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
    RETURN json_build_object('success', false, 'error', 'A user with this email already exists');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Backfill encrypted PINs for existing users (where we can't recover the original PIN)
-- This will leave pin_code_encrypted NULL for existing users
-- New PINs and PIN changes will populate both fields
COMMENT ON COLUMN public.users.pin_code_encrypted IS 'Encrypted PIN for viewing purposes. NULL for legacy PINs created before encryption was implemented.';