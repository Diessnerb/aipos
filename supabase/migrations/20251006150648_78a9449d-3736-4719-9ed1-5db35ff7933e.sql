-- ============================================================================
-- COSMETIC SECURITY FIX: Convert RLS policies from public to authenticated
-- ============================================================================
-- This migration converts existing RLS policies from "TO public" to 
-- "TO authenticated" for clarity. This is a cosmetic change - the existing
-- policies already require authentication via auth.uid() checks, but this
-- makes the scanner happy and improves code clarity.

-- USERS table - Already has proper company isolation, just update role
DROP POLICY IF EXISTS "users_company_isolation_strict" ON public.users;
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

-- CUSTOMERS table - Already has proper company isolation
DROP POLICY IF EXISTS "customers_company_isolation_strict" ON public.customers;
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

-- RESERVATIONS table - Already has proper company isolation
DROP POLICY IF EXISTS "reservations_company_isolation_strict" ON public.reservations;
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

-- SUPER_ADMINS table - Restrict to super admins only (not just any authenticated user)
DROP POLICY IF EXISTS "super_admins_self_view" ON public.super_admins;
CREATE POLICY "super_admins_self_view"
ON public.super_admins
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR is_super_admin()
);

-- Ensure super admins can manage the table
DROP POLICY IF EXISTS "super_admins_manage" ON public.super_admins;
CREATE POLICY "super_admins_manage"
ON public.super_admins
FOR ALL
TO authenticated
USING (
  is_super_admin()
)
WITH CHECK (
  is_super_admin()
);