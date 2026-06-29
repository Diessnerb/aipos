-- Fix infinite recursion in users table RLS policies (Phase 1 - Drop all existing)
-- This is the root cause of the super admin panel freezing

-- Drop ALL existing policies on users table to start fresh
DROP POLICY IF EXISTS "Company users can view their company users" ON public.users;
DROP POLICY IF EXISTS "Company users can manage their company users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "users_super_admin_access" ON public.users;
DROP POLICY IF EXISTS "users_own_profile_access" ON public.users;
DROP POLICY IF EXISTS "users_company_admin_access" ON public.users;
DROP POLICY IF EXISTS "Allow company admins to manage company users" ON public.users;
DROP POLICY IF EXISTS "Allow super admins to manage all users" ON public.users;
DROP POLICY IF EXISTS "Allow users to view their own data" ON public.users;
DROP POLICY IF EXISTS "Allow users to update their own data" ON public.users;

-- Create secure functions that avoid circular dependencies
CREATE OR REPLACE FUNCTION public.get_current_user_company_direct()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

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