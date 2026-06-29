-- Clean up all duplicate and problematic RLS policies on users table
DROP POLICY IF EXISTS "Company admins can manage company users" ON public.users;
DROP POLICY IF EXISTS "Company admins can view company users" ON public.users;
DROP POLICY IF EXISTS "Super admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Users can access their own record" ON public.users;
DROP POLICY IF EXISTS "Users can view same company users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own record" ON public.users;
DROP POLICY IF EXISTS "users_admin_manage_company" ON public.users;
DROP POLICY IF EXISTS "users_authenticated_access" ON public.users;
DROP POLICY IF EXISTS "users_company_admin_view" ON public.users;
DROP POLICY IF EXISTS "users_own_profile_access" ON public.users;
DROP POLICY IF EXISTS "users_select_safe" ON public.users;
DROP POLICY IF EXISTS "users_super_admin_access" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;

-- Create clean, non-recursive RLS policies
CREATE POLICY "users_own_access"
ON public.users 
FOR ALL
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "users_company_isolation"
ON public.users 
FOR SELECT
USING (
  company_id IN (
    SELECT allowed_company_ids_for_current_user()
  )
);

CREATE POLICY "users_super_admin_full_access"
ON public.users 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());