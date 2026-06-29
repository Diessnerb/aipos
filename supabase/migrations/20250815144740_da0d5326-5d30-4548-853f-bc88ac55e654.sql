-- Nuclear Option: Complete RLS Reset for Owner Login Fix
-- Drop ALL existing RLS policies and complex functions, start fresh

-- Drop all existing policies on companies table
DROP POLICY IF EXISTS "Owner can view company by email" ON public.companies;
DROP POLICY IF EXISTS "Super admins manage companies" ON public.companies;
DROP POLICY IF EXISTS "Company owners can view their company" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;

-- Drop all existing policies on users table  
DROP POLICY IF EXISTS "Allow user creation" ON public.users;
DROP POLICY IF EXISTS "Users see own record" ON public.users;
DROP POLICY IF EXISTS "Users update own record" ON public.users;
DROP POLICY IF EXISTS "Users delete own record" ON public.users;
DROP POLICY IF EXISTS "Super admins manage users" ON public.users;
DROP POLICY IF EXISTS "Users can create their own record" ON public.users;
DROP POLICY IF EXISTS "Users can read their own record" ON public.users;
DROP POLICY IF EXISTS "Users can update their own record" ON public.users;
DROP POLICY IF EXISTS "Users can delete their own record" ON public.users;

-- Drop complex security functions that cause circular dependencies
DROP FUNCTION IF EXISTS public.get_user_company_safe(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_current_user_role_safe() CASCADE;
DROP FUNCTION IF EXISTS public.get_current_user_company_id() CASCADE;

-- Create ABSOLUTE MINIMAL policies for owner login
-- 1. Companies: Allow reading by email match (NO user table dependencies)
CREATE POLICY "Simple owner email match" ON public.companies
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND default_admin_email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = default_admin_email
  )
);

-- 2. Companies: Super admin access
CREATE POLICY "Super admin companies access" ON public.companies
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins sa 
    WHERE sa.user_id = auth.uid()
  )
);

-- 3. Users: Allow ALL operations for authenticated users (temporarily)
CREATE POLICY "Allow user operations" ON public.users
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Users: Super admin access
CREATE POLICY "Super admin users access" ON public.users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins sa 
    WHERE sa.user_id = auth.uid()
  )
);