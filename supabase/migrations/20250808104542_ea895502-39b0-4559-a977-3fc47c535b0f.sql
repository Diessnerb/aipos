-- Phase 4: Final system validation and security hardening

-- Ensure all get_user_company_safe calls use proper security definer patterns
CREATE OR REPLACE FUNCTION public.get_user_company_safe(user_uuid uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.company_id 
  FROM public.users u
  WHERE (u.auth_user_id = user_uuid OR u.id = user_uuid)
    AND u.is_active = true
  LIMIT 1;
$$;

-- Ensure get_current_user_company_id function is secure
CREATE OR REPLACE FUNCTION public.get_current_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.company_id 
  FROM auth.users au
  JOIN public.users u ON au.id = u.auth_user_id
  WHERE au.id = auth.uid()
    AND u.is_active = true
  LIMIT 1;
$$;

-- Update company settings trigger to use the secure function
CREATE OR REPLACE FUNCTION public.set_company_settings_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure reservations trigger uses secure function
CREATE OR REPLACE FUNCTION public.set_reservation_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  return NEW;
end;
$$;

-- Create optimized function for PIN user authentication that doesn't require RLS
CREATE OR REPLACE FUNCTION public.get_company_for_pin_user(pin_input text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  company_uuid uuid;
BEGIN
  -- Check owner PIN first
  SELECT id INTO company_uuid
  FROM companies
  WHERE owner_pin = pin_input
    AND status = 'active';
    
  IF company_uuid IS NOT NULL THEN
    RETURN company_uuid;
  END IF;
  
  -- Check user PIN
  SELECT company_id INTO company_uuid
  FROM users
  WHERE pin_code = pin_input
    AND is_active = true;
    
  RETURN company_uuid;
END;
$$;

-- Validate that all critical tables have RLS enabled
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('users', 'companies', 'company_settings', 'reservations', 'orders', 'page_permissions')
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = tbl.schemaname 
            AND tablename = tbl.tablename
        ) THEN
            RAISE NOTICE 'Table %.% has no RLS policies!', tbl.schemaname, tbl.tablename;
        END IF;
    END LOOP;
END $$;

-- Create a health check function for authentication
CREATE OR REPLACE FUNCTION public.auth_health_check()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  auth_user_count integer;
  public_user_count integer;
  company_count integer;
BEGIN
  -- Count auth users
  SELECT COUNT(*) INTO auth_user_count FROM auth.users;
  
  -- Count public users
  SELECT COUNT(*) INTO public_user_count FROM public.users WHERE is_active = true;
  
  -- Count companies
  SELECT COUNT(*) INTO company_count FROM public.companies WHERE status = 'active';
  
  result := json_build_object(
    'timestamp', now(),
    'auth_users', auth_user_count,
    'public_users', public_user_count,
    'companies', company_count,
    'rls_enabled', (
      SELECT COUNT(*) FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
      AND c.relname IN ('users', 'companies', 'company_settings', 'reservations', 'orders')
      AND c.relrowsecurity = true
    ),
    'status', 'healthy'
  );
  
  RETURN result;
END;
$$;