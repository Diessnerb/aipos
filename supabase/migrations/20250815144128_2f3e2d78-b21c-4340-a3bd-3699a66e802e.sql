-- Revert complex security and fix owner login - Part 2: Add simple policies
-- Create minimal, non-circular policies that allow owner login to work

-- 1. Simple companies policy - allows authenticated users to see companies where their email matches admin email
CREATE POLICY "Owner can view company by email" ON public.companies
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND default_admin_email IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email::text = default_admin_email::text
  )
);

-- 2. Super admin policy for companies
CREATE POLICY "Super admins manage companies" ON public.companies
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM public.super_admins sa 
    WHERE sa.user_id = auth.uid()
  )
);

-- 3. Simple users policies - allow user creation and basic access
CREATE POLICY "Allow user creation" ON public.users
FOR INSERT
WITH CHECK (true); -- Allow all user creation during auth flows

CREATE POLICY "Users see own record" ON public.users
FOR SELECT
USING (auth_user_id = auth.uid() OR auth.uid() IS NULL); -- Allow during creation

CREATE POLICY "Users update own record" ON public.users
FOR UPDATE
USING (auth_user_id = auth.uid());

CREATE POLICY "Users delete own record" ON public.users
FOR DELETE
USING (auth_user_id = auth.uid());

-- 4. Super admin policies for users
CREATE POLICY "Super admins manage users" ON public.users
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM public.super_admins sa 
    WHERE sa.user_id = auth.uid()
  )
);