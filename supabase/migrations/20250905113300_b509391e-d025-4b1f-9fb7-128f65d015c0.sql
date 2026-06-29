-- Fix infinite recursion in users table RLS policies
-- Drop problematic policies that cause recursion
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Admin users can view all company users" ON public.users;

-- Create safe policies using security definer functions
DROP POLICY IF EXISTS "Users can view their own user data" ON public.users;
CREATE POLICY "Users can view their own user data" ON public.users 
FOR SELECT 
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own user data" ON public.users;
CREATE POLICY "Users can update their own user data" ON public.users 
FOR UPDATE 
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Company admins can view company users" ON public.users;
CREATE POLICY "Company admins can view company users" ON public.users 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND (role = 'admin' OR is_company_admin = true)
  )
);

DROP POLICY IF EXISTS "Super admins can manage all users" ON public.users;
CREATE POLICY "Super admins can manage all users" ON public.users 
FOR ALL 
USING (public.is_super_admin());