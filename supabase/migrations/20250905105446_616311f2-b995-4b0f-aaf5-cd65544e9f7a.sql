-- Fix RLS infinite recursion on users table by creating security definer functions
-- This prevents the circular dependency that's causing timeouts

-- Create security definer function to get user's own company safely
CREATE OR REPLACE FUNCTION public.get_user_own_company_id()
RETURNS uuid AS $$
  SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Create security definer function to check if user is in same company
CREATE OR REPLACE FUNCTION public.is_same_company(target_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u1
    JOIN public.users u2 ON u1.company_id = u2.company_id
    WHERE u1.auth_user_id = auth.uid() 
    AND u2.id = target_user_id
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Create security definer function to check admin permissions
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND (u.role = 'admin' OR u.is_company_admin = true)
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;