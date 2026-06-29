
-- Disable RLS and remove all policies for users table
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies on the users table (if they exist)
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;
DROP POLICY IF EXISTS "Users can delete their own data" ON public.users;
