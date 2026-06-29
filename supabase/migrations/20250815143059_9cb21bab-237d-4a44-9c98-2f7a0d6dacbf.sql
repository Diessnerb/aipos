-- Revert complex security and fix owner login circular dependency
-- Remove all complex RLS policies that create circular dependencies

-- 1. Drop all existing companies table policies
DROP POLICY IF EXISTS "Users can view company by admin email" ON public.companies;
DROP POLICY IF EXISTS "Linked users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Company users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Users can find company by admin email securely" ON public.companies;
DROP POLICY IF EXISTS "Super admins can delete companies" ON public.companies;

-- 2. Create a simple, direct policy for companies table that doesn't depend on users table
DROP POLICY IF EXISTS "Authenticated users can view companies by email match" ON public.companies;
CREATE POLICY "Authenticated users can view companies by email match" ON public.companies
FOR SELECT 
USING (
  -- Simple: authenticated user's email matches company's admin email
  auth.uid() IS NOT NULL 
  AND default_admin_email IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email::text = default_admin_email::text
  )
);

-- 3. Super admin policy (keep this simple)
DROP POLICY IF EXISTS "Super admins can manage companies" ON public.companies;
CREATE POLICY "Super admins can manage companies" ON public.companies
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM public.super_admins sa 
    WHERE sa.user_id = auth.uid()
  )
);

-- 4. Simplify users table policies - remove complex company checks
DROP POLICY IF EXISTS "Company users can view their company users" ON public.users;
DROP POLICY IF EXISTS "Company users can manage their company users" ON public.users;
DROP POLICY IF EXISTS "Users can view users in their company" ON public.users;

-- 5. Create simple users policies
DROP POLICY IF EXISTS "Users can view their own record" ON public.users;
CREATE POLICY "Users can view their own record" ON public.users
FOR SELECT
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own record" ON public.users;
CREATE POLICY "Users can update their own record" ON public.users
FOR UPDATE
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "System can create user records" ON public.users;
CREATE POLICY "System can create user records" ON public.users
FOR INSERT
WITH CHECK (true); -- Allow user creation during auth flows

DROP POLICY IF EXISTS "Company users can view company users" ON public.users;
CREATE POLICY "Company users can view company users" ON public.users
FOR SELECT
USING (
  -- Users can see other users in the same company
  company_id IS NOT NULL 
  AND company_id = (
    SELECT u.company_id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    LIMIT 1
  )
);

-- 6. Super admin policies for users
DROP POLICY IF EXISTS "Super admins can manage all users" ON public.users;
CREATE POLICY "Super admins can manage all users" ON public.users
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM public.super_admins sa 
    WHERE sa.user_id = auth.uid()
  )
);