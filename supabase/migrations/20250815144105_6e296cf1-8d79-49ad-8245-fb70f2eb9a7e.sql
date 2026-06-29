-- Revert complex security and fix owner login - Part 1: Clean existing policies
-- Drop ALL existing policies on companies and users tables to start fresh

-- Drop all companies policies
DROP POLICY IF EXISTS "Users can view company by admin email" ON public.companies;
DROP POLICY IF EXISTS "Linked users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Company users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Users can find company by admin email securely" ON public.companies;
DROP POLICY IF EXISTS "Super admins can delete companies" ON public.companies;
DROP POLICY IF EXISTS "Super admins can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can view companies by email match" ON public.companies;

-- Drop all users policies  
DROP POLICY IF EXISTS "Company users can view their company users" ON public.users;
DROP POLICY IF EXISTS "Company users can manage their company users" ON public.users;
DROP POLICY IF EXISTS "Users can view users in their company" ON public.users;
DROP POLICY IF EXISTS "Users can view their own record" ON public.users;
DROP POLICY IF EXISTS "Users can update their own record" ON public.users;
DROP POLICY IF EXISTS "System can create user records" ON public.users;
DROP POLICY IF EXISTS "Company users can view company users" ON public.users;
DROP POLICY IF EXISTS "Super admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Super admins can update users" ON public.users;