-- Fix infinite recursion in users table RLS policies
-- This is the root cause of the super admin panel freezing

-- First, drop problematic policies that cause circular dependencies
DROP POLICY IF EXISTS "Company users can view their company users" ON public.users;
DROP POLICY IF EXISTS "Company users can manage their company users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Create a secure function to get current user's company without circular dependency
CREATE OR REPLACE FUNCTION public.get_current_user_company_direct()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Use direct auth lookup to avoid circular dependencies
  SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Create a secure function to check if current user is super admin
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin_direct()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = auth.uid()
  );
$$;

-- Create new simplified RLS policies without circular dependencies
DROP POLICY IF EXISTS "users_own_profile_access" ON public.users;
CREATE POLICY "users_own_profile_access" ON public.users 
FOR ALL 
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "users_super_admin_access" ON public.users;
CREATE POLICY "users_super_admin_access" ON public.users 
FOR ALL 
USING (public.is_current_user_super_admin_direct())
WITH CHECK (public.is_current_user_super_admin_direct());

DROP POLICY IF EXISTS "users_company_admin_access" ON public.users;
CREATE POLICY "users_company_admin_access" ON public.users 
FOR SELECT 
USING (
  company_id = public.get_current_user_company_direct() 
  AND EXISTS (
    SELECT 1 FROM public.users u2 
    WHERE u2.auth_user_id = auth.uid() 
    AND (u2.role = 'admin' OR u2.is_company_admin = true)
  )
);

-- Update the get_user_company_safe function to be non-recursive
CREATE OR REPLACE FUNCTION public.get_user_company_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Add logging for debugging RLS issues
CREATE OR REPLACE FUNCTION public.log_rls_access(
  table_name text,
  operation text,
  user_id uuid DEFAULT auth.uid()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simple logging that won't cause recursion
  RAISE LOG 'RLS_ACCESS: table=%, operation=%, user=%, timestamp=%', 
    table_name, operation, user_id, now();
END;
$$;