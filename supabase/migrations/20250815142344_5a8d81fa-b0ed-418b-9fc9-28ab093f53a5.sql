-- Fix infinite recursion in users table RLS policy
-- The issue is that the policy queries the users table from within the users table policy

-- First, ensure we have a proper security definer function that doesn't cause recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT u.role 
  FROM auth.users au
  JOIN public.users u ON au.id = u.auth_user_id
  WHERE au.id = auth.uid()
    AND u.is_active = true
  LIMIT 1;
$$;

-- Create a function to check if current user can view company users
CREATE OR REPLACE FUNCTION public.can_view_company_users()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users au
    JOIN public.users u ON au.id = u.auth_user_id
    WHERE au.id = auth.uid()
      AND u.is_active = true
  );
$$;

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view users in their company" ON public.users;

-- Create a new, simpler policy that doesn't cause recursion
CREATE POLICY "Users can view users in their company" ON public.users
FOR SELECT 
USING (
  -- User can see their own record
  auth_user_id = auth.uid()
  OR 
  -- User can see others in same company if they have an active account
  (company_id = get_user_company_safe() AND can_view_company_users())
);

-- Also fix the company admins policy to be safer
DROP POLICY IF EXISTS "Company admins can manage users in their company" ON public.users;

CREATE POLICY "Company admins can manage users in their company" ON public.users
FOR ALL
USING (
  company_id = get_user_company_safe() 
  AND get_current_user_role_safe() = ANY (ARRAY['admin'::text, 'manager'::text])
)
WITH CHECK (
  company_id = get_user_company_safe() 
  AND get_current_user_role_safe() = ANY (ARRAY['admin'::text, 'manager'::text])
);