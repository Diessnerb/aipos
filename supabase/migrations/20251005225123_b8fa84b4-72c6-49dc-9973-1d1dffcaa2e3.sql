-- Fix authenticate_by_pin_for_company_secure to use SHA-256 matching change_team_member_pin
CREATE OR REPLACE FUNCTION public.authenticate_by_pin_for_company_secure(pin_input text, company_id_input uuid)
 RETURNS TABLE(user_id uuid, user_name text, company_id uuid, user_role text, is_owner boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  hashed_pin text;
  found_user_id uuid;
  found_user_name text;
  found_user_role text;
  found_company_id uuid := company_id_input;
  is_owner_result boolean := false;
  success_result boolean := false;
BEGIN
  -- Validate PIN format (4 digits)
  IF pin_input !~ '^\d{4}$' THEN
    RAISE LOG 'PIN validation failed for company %: Invalid format', company_id_input;
    INSERT INTO auth_attempts (company_id, pin_used, success, attempted_at)
    VALUES (company_id_input, '4', false, now());
    RETURN;
  END IF;

  -- Hash the PIN input using SHA-256 (matching change_team_member_pin)
  hashed_pin := encode(digest(pin_input, 'sha256'), 'hex');

  -- First try: Check for active user with matching PIN in the company
  SELECT u.id, u.full_name, u.role, u.company_id
  INTO found_user_id, found_user_name, found_user_role, found_company_id
  FROM public.users u
  WHERE u.pin_code = hashed_pin
    AND u.company_id = company_id_input
    AND u.is_active = true
  LIMIT 1;

  IF found_user_id IS NOT NULL THEN
    success_result := true;
    is_owner_result := (found_user_role = 'admin');
    RAISE LOG 'PIN validation successful for user % in company %', found_user_name, company_id_input;
  ELSE
    -- Second try: Check owner PIN
    SELECT c.id, c.name
    INTO found_company_id, found_user_name
    FROM public.companies c
    WHERE c.id = company_id_input
      AND c.owner_pin = hashed_pin
      AND c.status = 'active'
    LIMIT 1;

    IF found_company_id IS NOT NULL THEN
      -- Owner PIN matched
      SELECT u.id INTO found_user_id
      FROM public.users u
      WHERE u.company_id = company_id_input
        AND u.is_active = true
        AND (u.role = 'admin' OR u.is_company_admin = true)
      LIMIT 1;

      IF found_user_id IS NULL THEN
        SELECT u.id INTO found_user_id
        FROM public.users u
        WHERE u.company_id = company_id_input
          AND u.is_active = true
        LIMIT 1;
      END IF;

      success_result := true;
      is_owner_result := true;
      found_user_role := 'owner';
      found_user_name := found_user_name || ' Owner';
      RAISE LOG 'Owner PIN validation successful for company %', company_id_input;
    END IF;
  END IF;

  -- Log the attempt
  INSERT INTO auth_attempts (company_id, pin_used, success, attempted_at)
  VALUES (company_id_input, '4', success_result, now());

  -- Return result if successful
  IF success_result THEN
    RETURN QUERY SELECT 
      found_user_id,
      found_user_name,
      found_company_id,
      found_user_role,
      is_owner_result;
  ELSE
    RAISE LOG 'PIN validation failed for company %: No matching PIN found', company_id_input;
    RETURN;
  END IF;
END;
$$;