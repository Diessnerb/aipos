-- Step 1: Add RLS policy to allow authenticated users to find their company by admin email
CREATE POLICY "Authenticated users can find company by admin email during login"
ON public.companies
FOR SELECT
TO authenticated
USING (default_admin_email IS NOT NULL);

-- Step 2: Enhance the ensure_user_profile_for_current_auth function
CREATE OR REPLACE FUNCTION public.ensure_user_profile_for_current_auth()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_id uuid := auth.uid();
  v_email text;
  v_full_name text;
  v_role text;
  v_user_id uuid;
  v_company_id uuid;
  v_is_company_admin boolean := false;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get user details from auth
  SELECT au.email,
         COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
         COALESCE(au.raw_user_meta_data->>'role', 'staff')
  INTO v_email, v_full_name, v_role
  FROM auth.users au
  WHERE au.id = v_auth_id;

  -- Try to find company by matching email with companies.default_admin_email
  SELECT c.id INTO v_company_id
  FROM public.companies c
  WHERE c.default_admin_email = v_email
  LIMIT 1;

  -- If company found by admin email, this user should be a company admin
  IF v_company_id IS NOT NULL THEN
    v_is_company_admin := true;
    v_role := 'admin';
  END IF;

  -- Check if a users row already exists for this auth user
  SELECT id, company_id INTO v_user_id, v_company_id
  FROM public.users
  WHERE auth_user_id = v_auth_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- Create new user record
    INSERT INTO public.users (auth_user_id, email, full_name, role, company_id, is_company_admin)
    VALUES (v_auth_id, v_email, v_full_name, v_role, v_company_id, v_is_company_admin)
    RETURNING id INTO v_user_id;
  ELSE
    -- Update existing user record with company info if needed
    UPDATE public.users
    SET email = COALESCE(v_email, email),
        full_name = COALESCE(v_full_name, full_name),
        role = CASE WHEN v_is_company_admin THEN 'admin' ELSE COALESCE(v_role, role) END,
        company_id = COALESCE(v_company_id, company_id),
        is_company_admin = CASE WHEN v_is_company_admin THEN true ELSE is_company_admin END
    WHERE id = v_user_id;
  END IF;

  RETURN v_user_id;
END;
$function$;

-- Step 3: Create function to link existing users to companies
CREATE OR REPLACE FUNCTION public.link_user_to_company_by_email(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_auth_user_id uuid;
BEGIN
  -- Find company by admin email
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE default_admin_email = p_email
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No company found with this admin email');
  END IF;

  -- Find auth user by email
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No auth user found with this email');
  END IF;

  -- Find or create public user record
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_user_id = v_auth_user_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- Create new user record
    INSERT INTO public.users (auth_user_id, email, full_name, role, company_id, is_company_admin)
    VALUES (v_auth_user_id, p_email, 'Company Admin', 'admin', v_company_id, true)
    RETURNING id INTO v_user_id;
  ELSE
    -- Update existing user record
    UPDATE public.users
    SET company_id = v_company_id,
        is_company_admin = true,
        role = 'admin'
    WHERE id = v_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'User successfully linked to company',
    'user_id', v_user_id,
    'company_id', v_company_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Step 4: Create logging function for authentication debugging
CREATE OR REPLACE FUNCTION public.log_auth_attempt(
  p_email text,
  p_action text,
  p_success boolean,
  p_error_message text DEFAULT NULL,
  p_additional_data jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- This is a simple logging function - in production you might want to log to a dedicated table
  -- For now, we'll use the existing infrastructure
  RAISE LOG 'AUTH_LOG: email=%, action=%, success=%, error=%, data=%', 
    p_email, p_action, p_success, p_error_message, p_additional_data;
END;
$function$;

-- Step 5: Create trigger to auto-call ensure_user_profile when auth users sign in
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Call the ensure function when a user's last_sign_in_at changes (indicating a login)
  IF OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at AND NEW.last_sign_in_at IS NOT NULL THEN
    PERFORM public.ensure_user_profile_for_current_auth();
  END IF;
  RETURN NEW;
END;
$function$;

-- Note: We cannot create triggers on auth.users from public schema, so this trigger needs to be managed differently
-- The ensure_user_profile_for_current_auth function should be called from the application code after successful login