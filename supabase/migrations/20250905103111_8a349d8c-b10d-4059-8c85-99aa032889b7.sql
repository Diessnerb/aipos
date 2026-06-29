-- Fix infinite recursion in users table RLS policies (Phase 2 - Create new policies)
-- Create simplified RLS policies without circular dependencies

-- Policy 1: Users can access their own profile
CREATE POLICY "users_own_profile_access" 
ON public.users 
FOR ALL 
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Policy 2: Super admins can access all users  
CREATE POLICY "users_super_admin_access" 
ON public.users 
FOR ALL 
USING (public.is_current_user_super_admin_direct())
WITH CHECK (public.is_current_user_super_admin_direct());

-- Policy 3: Company admins can view users in their company (SELECT only to avoid recursion)
CREATE POLICY "users_company_admin_view" 
ON public.users 
FOR SELECT 
USING (
  company_id = public.get_current_user_company_direct() 
  AND EXISTS (
    SELECT 1 FROM public.users u2 
    WHERE u2.auth_user_id = auth.uid() 
    AND (u2.role = 'admin' OR u2.is_company_admin = true)
    LIMIT 1
  )
);

-- Update the get_user_company_safe function to be non-recursive
CREATE OR REPLACE FUNCTION public.get_user_company_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Fix search path issues from previous functions
ALTER FUNCTION public.get_current_user_company_direct() SET search_path = 'public';
ALTER FUNCTION public.is_current_user_super_admin_direct() SET search_path = 'public';