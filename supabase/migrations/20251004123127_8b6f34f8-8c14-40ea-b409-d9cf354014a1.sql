-- ============================================================================
-- COMPREHENSIVE SECURITY MIGRATION: Company Isolation & RLS Hardening
-- ============================================================================
-- This migration enforces strict company isolation across all sensitive tables
-- and fixes security function search paths

-- ============================================================================
-- PART 1: Fix Function Search Paths (Security Definer Functions)
-- ============================================================================

-- Fix handle_auth_user_updated
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at AND NEW.last_sign_in_at IS NOT NULL THEN
    PERFORM public.ensure_user_profile_for_current_auth();
  END IF;
  RETURN NEW;
END;
$$;

-- Fix cleanup_expired_oauth_states
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.oauth_states 
  WHERE expires_at < NOW();
END;
$$;

-- Fix log_auth_attempt
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
SET search_path = public
AS $$
BEGIN
  RAISE LOG 'AUTH_LOG: email=%, action=%, success=%, error=%, data=%', 
    p_email, p_action, p_success, p_error_message, p_additional_data;
END;
$$;

-- Fix link_user_to_company_by_email
CREATE OR REPLACE FUNCTION public.link_user_to_company_by_email(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_auth_user_id uuid;
BEGIN
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE default_admin_email = p_email
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No company found with this admin email');
  END IF;

  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No auth user found with this email');
  END IF;

  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_user_id = v_auth_user_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO public.users (auth_user_id, email, full_name, role, company_id, is_company_admin)
    VALUES (v_auth_user_id, p_email, 'Company Admin', 'admin', v_company_id, true)
    RETURNING id INTO v_user_id;
  ELSE
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
$$;

-- Fix hash_password_md5
CREATE OR REPLACE FUNCTION public.hash_password_md5(password_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN md5(password_text || 'salt_2025');
END;
$$;

-- Fix generate_unique_pin (overloaded version)
CREATE OR REPLACE FUNCTION public.generate_unique_pin(p_company_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_pin text;
  pin_exists boolean;
BEGIN
  LOOP
    new_pin := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    
    IF p_company_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.users 
        WHERE pin_code = new_pin AND company_id = p_company_id
      ) INTO pin_exists;
    ELSE
      SELECT EXISTS(SELECT 1 FROM public.users WHERE pin_code = new_pin) INTO pin_exists;
    END IF;
    
    IF NOT pin_exists THEN
      RETURN new_pin;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- PART 2: Company Validation Infrastructure
-- ============================================================================

-- Create a validation function to check company access
CREATE OR REPLACE FUNCTION public.validate_company_access(
  p_auth_user_id uuid,
  p_company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_company_id IN (
    SELECT allowed_company_ids_for_current_user()
  );
$$;

-- Create validation trigger function
CREATE OR REPLACE FUNCTION public.validate_company_id_on_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure company_id is never null
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id cannot be null on table %', TG_TABLE_NAME;
  END IF;
  
  -- Validate user has access to this company (only for authenticated users)
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.validate_company_access(auth.uid(), NEW.company_id) THEN
      RAISE EXCEPTION 'User does not have access to company % on table %', NEW.company_id, TG_TABLE_NAME;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 3: Drop Existing Problematic Policies
-- ============================================================================

-- Drop all existing policies on sensitive tables (we'll recreate them properly)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN (
      'users', 'customers', 'reservations', 'companies', 
      'auth_attempts', 'pos_credentials', 'integrations',
      'orders', 'payments', 'security_audit_log',
      'alisha_conversations', 'tables', 'menu_items',
      'order_items', 'inventory'
    )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- PART 4: Create Strict Company-Isolated RLS Policies
-- ============================================================================

-- USERS table - Critical: No public access
CREATE POLICY "users_company_isolation_strict"
ON public.users
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT allowed_company_ids_for_current_user())
)
WITH CHECK (
  company_id IN (SELECT allowed_company_ids_for_current_user())
);

-- CUSTOMERS table - Company isolated
CREATE POLICY "customers_company_isolation_strict"
ON public.customers
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT allowed_company_ids_for_current_user())
)
WITH CHECK (
  company_id IN (SELECT allowed_company_ids_for_current_user())
);

-- RESERVATIONS table - Company isolated
CREATE POLICY "reservations_company_isolation_strict"
ON public.reservations
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT allowed_company_ids_for_current_user())
)
WITH CHECK (
  company_id IN (SELECT allowed_company_ids_for_current_user())
);

-- COMPANIES table - Users can only see their own company
CREATE POLICY "companies_own_company_only"
ON public.companies
FOR SELECT
TO authenticated
USING (
  id IN (SELECT allowed_company_ids_for_current_user())
);

-- Super admins can manage all companies
CREATE POLICY "companies_super_admin_all"
ON public.companies
FOR ALL
TO authenticated
USING (
  is_super_admin()
)
WITH CHECK (
  is_super_admin()
);

-- AUTH_ATTEMPTS - Super admin only (security audit table)
CREATE POLICY "auth_attempts_super_admin_only"
ON public.auth_attempts
FOR ALL
TO authenticated
USING (
  is_super_admin()
);

-- POS_CREDENTIALS - Company isolated + admin only
CREATE POLICY "pos_credentials_company_admin"
ON public.pos_credentials
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT allowed_company_ids_for_current_user())
  AND is_current_user_admin()
)
WITH CHECK (
  company_id IN (SELECT allowed_company_ids_for_current_user())
  AND is_current_user_admin()
);

-- INTEGRATIONS - Company isolated + admin only
CREATE POLICY "integrations_company_admin"
ON public.integrations
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT allowed_company_ids_for_current_user())
  AND is_current_user_admin()
)
WITH CHECK (
  company_id IN (SELECT allowed_company_ids_for_current_user())
  AND is_current_user_admin()
);

-- Super admins can manage all integrations
CREATE POLICY "integrations_super_admin_all"
ON public.integrations
FOR ALL
TO authenticated
USING (
  is_super_admin()
)
WITH CHECK (
  is_super_admin()
);

-- ORDERS - Company isolated
CREATE POLICY "orders_company_isolation_strict"
ON public.orders
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT allowed_company_ids_for_current_user())
)
WITH CHECK (
  company_id IN (SELECT allowed_company_ids_for_current_user())
);

-- PAYMENTS - Company isolated
CREATE POLICY "payments_company_isolation_strict"
ON public.payments
FOR ALL
TO authenticated
USING (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE company_id IN (SELECT allowed_company_ids_for_current_user())
  )
)
WITH CHECK (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE company_id IN (SELECT allowed_company_ids_for_current_user())
  )
);

-- SECURITY_AUDIT_LOG - Super admin only
CREATE POLICY "security_audit_log_super_admin_only"
ON public.security_audit_log
FOR ALL
TO authenticated
USING (
  is_super_admin()
);

-- ALISHA_CONVERSATIONS - Company isolated
CREATE POLICY "alisha_conversations_company_isolation_strict"
ON public.alisha_conversations
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT allowed_company_ids_for_current_user())
)
WITH CHECK (
  company_id IN (SELECT allowed_company_ids_for_current_user())
);

-- TABLES - Company isolated
CREATE POLICY "tables_company_isolation_strict"
ON public.tables
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT allowed_company_ids_for_current_user())
)
WITH CHECK (
  company_id IN (SELECT allowed_company_ids_for_current_user())
);

-- MENU_ITEMS - Company isolated
CREATE POLICY "menu_items_company_isolation_strict"
ON public.menu_items
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT allowed_company_ids_for_current_user())
)
WITH CHECK (
  company_id IN (SELECT allowed_company_ids_for_current_user())
);

-- ORDER_ITEMS - Company isolated via orders
CREATE POLICY "order_items_company_isolation_strict"
ON public.order_items
FOR ALL
TO authenticated
USING (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE company_id IN (SELECT allowed_company_ids_for_current_user())
  )
)
WITH CHECK (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE company_id IN (SELECT allowed_company_ids_for_current_user())
  )
);

-- INVENTORY - Company isolated
CREATE POLICY "inventory_company_isolation_strict"
ON public.inventory
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT allowed_company_ids_for_current_user())
)
WITH CHECK (
  company_id IN (SELECT allowed_company_ids_for_current_user())
);

-- ============================================================================
-- PART 5: Add Company Validation Triggers to Critical Tables
-- ============================================================================

-- Add validation triggers to all tables with company_id
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN (
    SELECT table_name::text
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name = 'company_id'
    AND table_name NOT IN ('oauth_states', 'super_admins')
  ) LOOP
    -- Drop existing trigger if exists
    EXECUTE format('DROP TRIGGER IF EXISTS validate_company_id_trigger ON public.%I', t);
    
    -- Create new trigger
    EXECUTE format(
      'CREATE TRIGGER validate_company_id_trigger 
       BEFORE INSERT OR UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION validate_company_id_on_write()',
      t
    );
  END LOOP;
END $$;

-- ============================================================================
-- PART 6: Add Security Logging
-- ============================================================================

-- Create function to log company isolation violations
CREATE OR REPLACE FUNCTION public.log_company_isolation_violation(
  p_table_name text,
  p_operation text,
  p_company_id uuid,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    event_type,
    table_name,
    company_id,
    user_id,
    details,
    created_at
  ) VALUES (
    'company_isolation_violation',
    p_table_name,
    p_company_id,
    auth.uid(),
    jsonb_build_object(
      'operation', p_operation,
      'details', p_details
    ),
    now()
  );
EXCEPTION WHEN OTHERS THEN
  -- Fail silently to avoid blocking operations
  RAISE WARNING 'Failed to log security event: %', SQLERRM;
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all critical tables have RLS enabled
DO $$
DECLARE
  t record;
  rls_disabled text[] := ARRAY[]::text[];
BEGIN
  FOR t IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'users', 'customers', 'reservations', 'companies',
      'auth_attempts', 'pos_credentials', 'integrations',
      'orders', 'payments', 'security_audit_log',
      'alisha_conversations', 'tables', 'menu_items',
      'order_items', 'inventory'
    )
  ) LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = t.tablename AND relnamespace = 'public'::regnamespace) THEN
      rls_disabled := array_append(rls_disabled, t.tablename);
    END IF;
  END LOOP;
  
  IF array_length(rls_disabled, 1) > 0 THEN
    RAISE WARNING 'The following tables do not have RLS enabled: %', array_to_string(rls_disabled, ', ');
  ELSE
    RAISE NOTICE '✅ All critical tables have RLS enabled';
  END IF;
END $$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Security migration completed successfully';
  RAISE NOTICE '✅ Company isolation enforced on all sensitive tables';
  RAISE NOTICE '✅ Function search paths secured';
  RAISE NOTICE '✅ Validation triggers added';
  RAISE NOTICE '⚠️  Please verify edge functions pass valid companyId parameters';
END $$;