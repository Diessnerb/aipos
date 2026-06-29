-- 1) Ensure an auth user's profile exists in public.users
CREATE OR REPLACE FUNCTION public.ensure_user_profile_for_current_auth()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_email text;
  v_full_name text;
  v_role text;
  v_user_id uuid;
  v_company_id uuid;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT au.email,
         COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
         COALESCE(au.raw_user_meta_data->>'role', 'staff')
  INTO v_email, v_full_name, v_role
  FROM auth.users au
  WHERE au.id = v_auth_id;

  -- Try to infer the company by matching email with companies.default_admin_email
  SELECT c.id INTO v_company_id
  FROM public.companies c
  WHERE c.default_admin_email = v_email
  LIMIT 1;

  -- Check if a users row already exists for this auth user
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_user_id = v_auth_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO public.users (auth_user_id, email, full_name, role, company_id, is_company_admin)
    VALUES (v_auth_id, v_email, v_full_name, v_role, v_company_id, (v_role = 'admin'))
    RETURNING id INTO v_user_id;
  ELSE
    UPDATE public.users
    SET email = COALESCE(v_email, email),
        full_name = COALESCE(v_full_name, full_name),
        role = COALESCE(v_role, role),
        is_company_admin = CASE WHEN v_role = 'admin' THEN true ELSE is_company_admin END
    WHERE id = v_user_id;
  END IF;

  RETURN v_user_id;
END;
$$;

-- 2) Allow authenticated users to read their own users row (even before company_id is set)
DROP POLICY IF EXISTS "Authenticated users can view their own user row" ON public.users;
CREATE POLICY "Authenticated users can view their own user row"
ON public.users
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth_user_id = auth.uid());

-- 3) Company settings: auto-set company id (primary key) on insert
CREATE OR REPLACE FUNCTION public.set_company_settings_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_company_settings_company_id_before_insert ON public.company_settings;
CREATE TRIGGER set_company_settings_company_id_before_insert
BEFORE INSERT ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_company_settings_company_id();

-- Keep updated_at fresh on updates for company_settings and page_permissions
DROP TRIGGER IF EXISTS set_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER set_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_page_permissions_updated_at ON public.page_permissions;
CREATE TRIGGER set_page_permissions_updated_at
BEFORE UPDATE ON public.page_permissions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- 4) Company settings: allow admins/managers to insert their company's settings row
DROP POLICY IF EXISTS "Company admins/managers can insert their company settings" ON public.company_settings;
CREATE POLICY "Company admins/managers can insert their company settings"
ON public.company_settings
FOR INSERT
WITH CHECK (
  id = (
    SELECT u.company_id
    FROM public.users u
    WHERE u.auth_user_id = auth.uid() AND u.role IN ('admin','manager')
  )
);

-- 5) Page permissions: ensure company_id is set automatically on insert
DROP TRIGGER IF EXISTS set_page_permission_company_id_before_insert ON public.page_permissions;
CREATE TRIGGER set_page_permission_company_id_before_insert
BEFORE INSERT ON public.page_permissions
FOR EACH ROW
EXECUTE FUNCTION public.set_page_permission_company_id();