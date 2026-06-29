-- Fix companies table RLS policy circular dependency for owner login
-- The current policy requires users to exist in the users table, but during owner login
-- the user authenticates first, then looks up company, then gets added to users table

-- Drop the problematic company policy that requires users table lookup
DROP POLICY IF EXISTS "Company users can view their company" ON public.companies;

-- Create a simplified policy that allows authenticated users to view companies
-- where their auth email matches the company's default_admin_email
-- This breaks the circular dependency by not requiring users table lookup
CREATE POLICY "Users can view company by admin email" ON public.companies
FOR SELECT 
USING (
  -- Allow if user is authenticated and their email matches company admin email
  auth.uid() IS NOT NULL 
  AND default_admin_email IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = companies.default_admin_email
  )
);

-- Keep the existing policy for users already in the system
CREATE POLICY "Linked users can view their company" ON public.companies
FOR SELECT 
USING (
  -- Allow if user exists in users table and company matches
  id = get_user_company_safe()
  AND EXISTS (
    SELECT 1 
    FROM users u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.company_id = companies.id 
    AND u.is_active = true
  )
);