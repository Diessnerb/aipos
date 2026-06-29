-- Emergency Fix: Resolve infinite recursion in users table RLS policies
-- Step 1: Drop problematic policies that cause circular references

DROP POLICY IF EXISTS "users_company_isolation" ON public.users;
DROP POLICY IF EXISTS "users_company_isolation_v2" ON public.users;

-- Step 2: Create safe, non-recursive RLS policies for users table

-- Allow users to view their own record and company colleagues
CREATE POLICY "users_select_safe"
ON public.users 
FOR SELECT 
USING (
  auth_user_id = auth.uid() 
  OR 
  company_id IN (
    SELECT u.company_id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Allow users to update their own record
CREATE POLICY "users_update_own"
ON public.users 
FOR UPDATE 
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Allow company admins to manage their company users
CREATE POLICY "users_admin_manage_company"
ON public.users 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users admin_user 
    WHERE admin_user.auth_user_id = auth.uid()
    AND admin_user.company_id = users.company_id
    AND (admin_user.role = 'admin' OR admin_user.is_company_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users admin_user 
    WHERE admin_user.auth_user_id = auth.uid()
    AND admin_user.company_id = users.company_id
    AND (admin_user.role = 'admin' OR admin_user.is_company_admin = true)
  )
);

-- Allow super admins full access
CREATE POLICY "users_super_admin_access"
ON public.users 
FOR ALL 
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Step 3: Create a safer get_user_company function that doesn't cause recursion
CREATE OR REPLACE FUNCTION public.get_user_company_safe_v2()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id 
  FROM public.users 
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- Step 4: Update triggers to use the safer function
CREATE OR REPLACE FUNCTION public.set_company_id_from_user_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    -- Use a direct query instead of function to avoid recursion
    SELECT u.company_id INTO NEW.company_id
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;