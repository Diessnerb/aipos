-- Phase 4: Fix cross-schema reference issue in companies policy

-- Drop the problematic policy that references auth.users
DROP POLICY IF EXISTS "companies_owner_view" ON public.companies;

-- Create a much simpler companies policy that avoids cross-schema references
-- This allows any authenticated user to view companies (we'll filter by email in the application layer)
CREATE POLICY "companies_authenticated_view" ON public.companies
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Keep the super admin policy as-is
-- The super admin policy should remain:
-- CREATE POLICY "companies_super_admin" ON public.companies
-- FOR ALL
-- USING (EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid()));

-- Clean up any conflicting old user policies to ensure only our authenticated access policy remains
DROP POLICY IF EXISTS "Allow security definer functions to insert users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view their own user row" ON public.users;

-- Ensure we have clean user access policy
DROP POLICY IF EXISTS "users_authenticated_access" ON public.users;
CREATE POLICY "users_authenticated_access" ON public.users
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);