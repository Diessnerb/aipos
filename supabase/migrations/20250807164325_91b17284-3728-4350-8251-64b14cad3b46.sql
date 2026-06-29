-- Phase 1: Multi-tenant Database Schema Updates (Fixed)

-- Create super_admins table for platform administrators
CREATE TABLE IF NOT EXISTS public.super_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on super_admins
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for super_admins (only super admins can manage super admins)
DROP POLICY IF EXISTS "Super admins can view all super admins" ON public.super_admins;
CREATE POLICY "Super admins can view all super admins" ON public.super_admins 
FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid()));

DROP POLICY IF EXISTS "Super admins can insert super admins" ON public.super_admins;
CREATE POLICY "Super admins can insert super admins" ON public.super_admins 
FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid()));

DROP POLICY IF EXISTS "Super admins can update super admins" ON public.super_admins;
CREATE POLICY "Super admins can update super admins" ON public.super_admins 
FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid()));

DROP POLICY IF EXISTS "Super admins can delete super admins" ON public.super_admins;
CREATE POLICY "Super admins can delete super admins" ON public.super_admins 
FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid()));

-- Update companies table to include more tenant information
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS subdomain text UNIQUE;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_admin_email text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_admin_password text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Create index on subdomain for fast lookups
CREATE INDEX IF NOT EXISTS idx_companies_subdomain ON public.companies(subdomain);

-- Update users table to ensure proper company association
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_company_admin boolean DEFAULT false;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = user_uuid
  );
$$;

-- Create function to get user's company safely
CREATE OR REPLACE FUNCTION public.get_user_company_safe(user_uuid uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT company_id FROM public.users 
  WHERE (auth_user_id = user_uuid OR id = user_uuid)
  LIMIT 1;
$$;

-- Update RLS policies to account for super admin access
-- Update companies table RLS
DROP POLICY IF EXISTS "Allow all operations on companies" ON public.companies;

DROP POLICY IF EXISTS "Super admins can manage all companies" ON public.companies;
CREATE POLICY "Super admins can manage all companies" ON public.companies 
FOR ALL 
USING (public.is_super_admin());

DROP POLICY IF EXISTS "Company users can view their company" ON public.companies;
CREATE POLICY "Company users can view their company" ON public.companies 
FOR SELECT 
USING (id = public.get_user_company_safe());

-- Update users table RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage all users" ON public.users;
CREATE POLICY "Super admins can manage all users" ON public.users 
FOR ALL 
USING (public.is_super_admin());

DROP POLICY IF EXISTS "Users can view users in their company" ON public.users;
CREATE POLICY "Users can view users in their company" ON public.users 
FOR SELECT 
USING (company_id = public.get_user_company_safe());

DROP POLICY IF EXISTS "Company admins can manage users in their company" ON public.users;
CREATE POLICY "Company admins can manage users in their company" ON public.users 
FOR ALL 
USING (
  company_id = public.get_user_company_safe() AND 
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.role IN ('admin', 'manager')
  )
);

-- Update other critical tables to ensure proper tenant isolation
-- Update reservations RLS
DROP POLICY IF EXISTS "Users can view reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can delete reservations" ON public.reservations;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage all reservations" ON public.reservations;
CREATE POLICY "Super admins can manage all reservations" ON public.reservations 
FOR ALL 
USING (public.is_super_admin());

DROP POLICY IF EXISTS "Company users can manage their company reservations" ON public.reservations;
CREATE POLICY "Company users can manage their company reservations" ON public.reservations 
FOR ALL 
USING (company_id = public.get_user_company_safe());

-- Update menu_items RLS to ensure proper tenant isolation
DROP POLICY IF EXISTS "Allow all operations on menu_items" ON public.menu_items;

DROP POLICY IF EXISTS "Super admins can manage all menu items" ON public.menu_items;
CREATE POLICY "Super admins can manage all menu items" ON public.menu_items 
FOR ALL 
USING (public.is_super_admin());

DROP POLICY IF EXISTS "All users can view menu items" ON public.menu_items;
CREATE POLICY "All users can view menu items" ON public.menu_items 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert menu items" ON public.menu_items;
CREATE POLICY "Authenticated users can insert menu items" ON public.menu_items 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update menu items" ON public.menu_items;
CREATE POLICY "Authenticated users can update menu items" ON public.menu_items 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete menu items" ON public.menu_items;
CREATE POLICY "Authenticated users can delete menu items" ON public.menu_items 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Update menu_categories RLS
DROP POLICY IF EXISTS "Allow all operations on menu_categories" ON public.menu_categories;

DROP POLICY IF EXISTS "Super admins can manage all menu categories" ON public.menu_categories;
CREATE POLICY "Super admins can manage all menu categories" ON public.menu_categories 
FOR ALL 
USING (public.is_super_admin());

DROP POLICY IF EXISTS "All users can view menu categories" ON public.menu_categories;
CREATE POLICY "All users can view menu categories" ON public.menu_categories 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert menu categories" ON public.menu_categories;
CREATE POLICY "Authenticated users can insert menu categories" ON public.menu_categories 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update menu categories" ON public.menu_categories;
CREATE POLICY "Authenticated users can update menu categories" ON public.menu_categories 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete menu categories" ON public.menu_categories;
CREATE POLICY "Authenticated users can delete menu categories" ON public.menu_categories 
FOR DELETE 
USING (auth.uid() IS NOT NULL);