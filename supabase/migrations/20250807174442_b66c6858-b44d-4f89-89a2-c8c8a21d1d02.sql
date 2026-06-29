-- Fix infinite recursion in RLS policies

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Company admins can manage users in their company" ON public.users;
DROP POLICY IF EXISTS "Users can view users in their company" ON public.users;
DROP POLICY IF EXISTS "Super admins can manage all users" ON public.users;

DROP POLICY IF EXISTS "Super admins can view all super admins" ON public.super_admins;
DROP POLICY IF EXISTS "Super admins can insert super admins" ON public.super_admins;
DROP POLICY IF EXISTS "Super admins can update super admins" ON public.super_admins;
DROP POLICY IF EXISTS "Super admins can delete super admins" ON public.super_admins;

-- Create new security definer functions that avoid recursion
CREATE OR REPLACE FUNCTION public.get_current_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id 
  FROM auth.users au
  JOIN public.users u ON au.id = u.auth_user_id
  WHERE au.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.role 
  FROM auth.users au
  JOIN public.users u ON au.id = u.auth_user_id
  WHERE au.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
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

-- Create new RLS policies for users table
CREATE POLICY "Super admins can manage all users" 
ON public.users 
FOR ALL 
USING (public.is_current_user_super_admin());

CREATE POLICY "Company admins can manage users in their company" 
ON public.users 
FOR ALL 
USING (
  company_id = public.get_current_user_company_id() 
  AND public.get_current_user_role() = ANY (ARRAY['admin', 'manager'])
);

CREATE POLICY "Users can view users in their company" 
ON public.users 
FOR SELECT 
USING (company_id = public.get_current_user_company_id());

-- Create new RLS policies for super_admins table
CREATE POLICY "Super admins can view all super admins" 
ON public.super_admins 
FOR SELECT 
USING (public.is_current_user_super_admin());

CREATE POLICY "Super admins can insert super admins" 
ON public.super_admins 
FOR INSERT 
WITH CHECK (public.is_current_user_super_admin());

CREATE POLICY "Super admins can update super admins" 
ON public.super_admins 
FOR UPDATE 
USING (public.is_current_user_super_admin());

CREATE POLICY "Super admins can delete super admins" 
ON public.super_admins 
FOR DELETE 
USING (public.is_current_user_super_admin());