
-- Create or update a company admin for an existing company
CREATE OR REPLACE FUNCTION public.create_company_admin_for_existing_company(
  p_company_id uuid,
  p_email text,
  p_password text,
  p_full_name text DEFAULT 'Company Admin'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_admin_id uuid;
  v_auth_user_id uuid;
  v_public_user_id uuid;
  v_existing_auth_user_id uuid;
BEGIN
  -- Only super admins can run this
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Ensure company exists
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company_id) THEN
    RETURN json_build_object('success', false, 'error', 'Company not found');
  END IF;

  -- Check for an existing admin user in the company
  SELECT u.id INTO v_existing_admin_id
  FROM public.users u
  WHERE u.company_id = p_company_id AND u.is_company_admin = true
  LIMIT 1;

  IF v_existing_admin_id IS NOT NULL THEN
    -- Update the existing admin's credentials
    PERFORM public.update_company_admin_credentials(p_company_id, p_email, p_password);
  ELSE
    -- Check if the email already exists in auth
    SELECT id INTO v_existing_auth_user_id
    FROM auth.users
    WHERE email = p_email;

    IF v_existing_auth_user_id IS NOT NULL THEN
      -- Ensure a public.users record exists for this company and set as company admin
      IF EXISTS (
        SELECT 1 FROM public.users u WHERE u.auth_user_id = v_existing_auth_user_id AND u.company_id = p_company_id
      ) THEN
        UPDATE public.users
        SET is_company_admin = true,
            role = 'admin',
            email = p_email,
            full_name = COALESCE(p_full_name, full_name)
        WHERE auth_user_id = v_existing_auth_user_id
          AND company_id = p_company_id
        RETURNING id INTO v_public_user_id;
      ELSE
        INSERT INTO public.users (auth_user_id, email, full_name, role, company_id, is_company_admin)
        VALUES (v_existing_auth_user_id, p_email, p_full_name, 'admin', p_company_id, true)
        RETURNING id INTO v_public_user_id;
      END IF;

      -- Update the auth user password
      UPDATE auth.users
      SET encrypted_password = crypt(p_password, gen_salt('bf')),
          updated_at = now()
      WHERE id = v_existing_auth_user_id;

      v_auth_user_id := v_existing_auth_user_id;
    ELSE
      -- Create a new auth user
      INSERT INTO auth.users (
        email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data
      ) VALUES (
        p_email, crypt(p_password, gen_salt('bf')), now(), now(), now(),
        json_build_object('full_name', p_full_name, 'role', 'admin')
      )
      RETURNING id INTO v_auth_user_id;

      -- Create the public.users row
      INSERT INTO public.users (auth_user_id, email, full_name, role, company_id, is_company_admin)
      VALUES (v_auth_user_id, p_email, p_full_name, 'admin', p_company_id, true)
      RETURNING id INTO v_public_user_id;
    END IF;

    -- Update company defaults
    UPDATE public.companies
    SET default_admin_email = p_email,
        default_admin_password = p_password,
        updated_at = now()
    WHERE id = p_company_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Company admin ensured/updated',
    'company_id', p_company_id,
    'auth_user_id', v_auth_user_id,
    'public_user_id', v_public_user_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Create the admin for Loom Bar & Cafe
SELECT public.create_company_admin_for_existing_company(
  (SELECT id FROM public.companies WHERE lower(name) = lower('Loom Bar & Cafe') LIMIT 1),
  'dec@dec.com',
  'declan21',
  'Dec'
);
