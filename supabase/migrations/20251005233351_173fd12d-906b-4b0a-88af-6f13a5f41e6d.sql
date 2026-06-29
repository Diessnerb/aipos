-- Ensure pgcrypto functions are available (Supabase has it, but safe to reference via extensions.digest)
-- Update secure company-scoped PIN authentication to support legacy owner PIN hash formats and avoid RLS failures on logging
CREATE OR REPLACE FUNCTION public.authenticate_by_pin_for_company_secure(
  pin_input text,
  company_id_input uuid
)
RETURNS TABLE(
  user_id uuid,
  user_name text,
  company_id uuid,
  user_role text,
  is_owner boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  hashed_pin_sha256 text;
  hashed_pin_md5 text;
  salted_md5_input text;
  encrypted_pin_input text;
  password_hashed_input text;
  plain_md5_input text;

  found_user_id uuid;
  found_user_name text;
  found_user_role text;
  found_company_id uuid := company_id_input;
  is_owner_result boolean := false;
  success_result boolean := false;
  owner_match_method text := NULL;
BEGIN
  -- Basic format validation: exactly 4 digits
  IF pin_input !~ '^\d{4}$' THEN
    RAISE LOG 'authenticate_by_pin_for_company_secure: invalid PIN format for company %', company_id_input;
    -- Best-effort logging; ignore RLS errors
    BEGIN
      INSERT INTO public.auth_attempts (company_id, pin_used, success, attempted_at)
      VALUES (company_id_input, '4', false, now());
    EXCEPTION WHEN OTHERS THEN
      -- ignore RLS or other errors
      NULL;
    END;
    RETURN;
  END IF;

  -- Precompute various representations
  hashed_pin_sha256 := encode(extensions.digest(convert_to(pin_input, 'UTF8'), 'sha256'), 'hex');
  hashed_pin_md5 := encode(extensions.digest(convert_to(pin_input, 'UTF8'), 'md5'), 'hex');
  salted_md5_input := public.hash_pin_md5(pin_input); -- salted md5 variant used historically for owner_pin
  encrypted_pin_input := public.encrypt_pin(pin_input); -- legacy digit-translate + base64
  password_hashed_input := encode(extensions.digest(convert_to('password' || pin_input, 'UTF8'), 'md5'), 'hex');
  plain_md5_input := hashed_pin_md5; -- alias for readability

  -- 1) Staff/manager user PIN: only SHA-256
  SELECT u.id, u.full_name, u.role, u.company_id
  INTO found_user_id, found_user_name, found_user_role, found_company_id
  FROM public.users u
  WHERE u.pin_code = hashed_pin_sha256
    AND u.company_id = company_id_input
    AND u.is_active = true
  LIMIT 1;

  IF found_user_id IS NOT NULL THEN
    success_result := true;
    is_owner_result := (found_user_role = 'owner' OR found_user_role = 'admin' OR uPPER(found_user_role) IN ('OWNER','ADMIN'));
    RAISE LOG 'authenticate_by_pin_for_company_secure: user PIN success for % in company %', found_user_name, company_id_input;
  ELSE
    -- 2) Owner/company-level PIN with multiple legacy formats
    PERFORM 1 FROM public.companies c
    WHERE c.id = company_id_input
      AND c.status = 'active'
      AND (
        c.owner_pin = hashed_pin_sha256 OR
        c.owner_pin = salted_md5_input OR
        c.owner_pin = encrypted_pin_input OR
        c.owner_pin = password_hashed_input OR
        c.owner_pin = plain_md5_input OR
        c.owner_pin = pin_input
      );

    IF FOUND THEN
      -- Try to attach to an active admin; fallback to any active user
      SELECT u.id, u.full_name, u.role
      INTO found_user_id, found_user_name, found_user_role
      FROM public.users u
      WHERE u.company_id = company_id_input
        AND u.is_active = true
        AND (u.role = 'admin' OR u.is_company_admin = true OR u.role = 'owner')
      ORDER BY u.role = 'owner' DESC, u.role = 'admin' DESC, u.is_company_admin DESC, u.created_at ASC NULLS LAST
      LIMIT 1;

      IF found_user_id IS NULL THEN
        SELECT u.id, u.full_name, u.role
        INTO found_user_id, found_user_name, found_user_role
        FROM public.users u
        WHERE u.company_id = company_id_input
          AND u.is_active = true
        ORDER BY u.created_at ASC NULLS LAST
        LIMIT 1;
      END IF;

      IF found_user_id IS NOT NULL THEN
        success_result := true;
        is_owner_result := true;
        -- Label as owner access if role not explicitly owner
        IF found_user_role IS NULL OR found_user_role NOT IN ('owner','admin') THEN
          found_user_role := 'owner';
        END IF;
        RAISE LOG 'authenticate_by_pin_for_company_secure: owner PIN success for company % (user attached: %)', company_id_input, found_user_name;
      ELSE
        -- If company has no users, do not succeed to avoid returning null IDs
        success_result := false;
        RAISE LOG 'authenticate_by_pin_for_company_secure: owner PIN matched but no active users in company %', company_id_input;
      END IF;
    END IF;
  END IF;

  -- Attempt logging of the auth attempt; swallow errors (e.g., RLS)
  BEGIN
    INSERT INTO public.auth_attempts (company_id, pin_used, success, attempted_at)
    VALUES (company_id_input, '4', success_result, now());
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF success_result THEN
    RETURN QUERY SELECT found_user_id, COALESCE(found_user_name, 'Owner Access'), found_company_id, COALESCE(found_user_role, 'owner'), is_owner_result;
  ELSE
    RAISE LOG 'authenticate_by_pin_for_company_secure: PIN validation failed for company %', company_id_input;
    RETURN;
  END IF;
END;
$function$;