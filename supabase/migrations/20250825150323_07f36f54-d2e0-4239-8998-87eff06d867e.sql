
BEGIN;

-- Safety: ensure the helper functions are executable by app sessions
GRANT EXECUTE ON FUNCTION public.allowed_company_ids_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_safe() TO authenticated;

-- Safety: ensure authenticated role can SELECT from public.users (required during policy evaluation)
GRANT SELECT ON TABLE public.users TO authenticated;

-- Make sure RLS is enabled on the tables table
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Replace the problematic policy on tables that references auth.users
DROP POLICY IF EXISTS "tables_company_isolation" ON public.tables;

-- Primary company isolation policy using the safe SECURITY DEFINER helper (no direct query to auth.users)
CREATE POLICY "tables_company_isolation_v2"
ON public.tables
AS PERMISSIVE
FOR ALL
TO authenticated
USING (company_id IN (SELECT public.allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT public.allowed_company_ids_for_current_user()));

-- Super admins: full access to tables
CREATE POLICY "tables_super_admin_full_access"
ON public.tables
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_current_user_super_admin())
WITH CHECK (public.is_current_user_super_admin());

COMMIT;
