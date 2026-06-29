-- Phase 1: Multi-tenant Database Schema Updates

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
CREATE POLICY "Super admins can view all super admins" 
ON public.super_admins 
FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid()));

CREATE POLICY "Super admins can insert super admins" 
ON public.super_admins 
FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid()));

CREATE POLICY "Super admins can update super admins" 
ON public.super_admins 
FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid()));

CREATE POLICY "Super admins can delete super admins" 
ON public.super_admins 
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

CREATE POLICY "Super admins can manage all companies" 
ON public.companies 
FOR ALL 
USING (public.is_super_admin());

CREATE POLICY "Company users can view their company" 
ON public.companies 
FOR SELECT 
USING (id = public.get_user_company_safe());

-- Update users table RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all users" 
ON public.users 
FOR ALL 
USING (public.is_super_admin());

CREATE POLICY "Users can view users in their company" 
ON public.users 
FOR SELECT 
USING (company_id = public.get_user_company_safe());

CREATE POLICY "Company admins can manage users in their company" 
ON public.users 
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

CREATE POLICY "Super admins can manage all reservations" 
ON public.reservations 
FOR ALL 
USING (public.is_super_admin());

CREATE POLICY "Company users can manage their company reservations" 
ON public.reservations 
FOR ALL 
USING (company_id = public.get_user_company_safe());

-- Update menu_items RLS to ensure proper tenant isolation
DROP POLICY IF EXISTS "Allow all operations on menu_items" ON public.menu_items;

CREATE POLICY "Super admins can manage all menu items" 
ON public.menu_items 
FOR ALL 
USING (public.is_super_admin());

CREATE POLICY "All users can view menu items" 
ON public.menu_items 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage menu items" 
ON public.menu_items 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Update menu_categories RLS
DROP POLICY IF EXISTS "Allow all operations on menu_categories" ON public.menu_categories;

CREATE POLICY "Super admins can manage all menu categories" 
ON public.menu_categories 
FOR ALL 
USING (public.is_super_admin());

CREATE POLICY "All users can view menu categories" 
ON public.menu_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage menu categories" 
ON public.menu_categories 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Create function to create new company with default admin
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  company_name text,
  company_subdomain text,
  admin_email text,
  admin_password text,
  admin_full_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_company_id uuid;
  new_user_id uuid;
  auth_user_id uuid;
BEGIN
  -- Only super admins can create companies
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Check if subdomain already exists
  IF EXISTS (SELECT 1 FROM public.companies WHERE subdomain = company_subdomain) THEN
    RETURN json_build_object('success', false, 'error', 'Subdomain already exists');
  END IF;
  
  -- Create the company
  INSERT INTO public.companies (name, subdomain, default_admin_email, default_admin_password)
  VALUES (company_name, company_subdomain, admin_email, admin_password)
  RETURNING id INTO new_company_id;
  
  -- Create auth user
  INSERT INTO auth.users (
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data
  ) VALUES (
    admin_email,
    crypt(admin_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    json_build_object('full_name', admin_full_name)
  ) RETURNING id INTO auth_user_id;
  
  -- Create user in public schema
  INSERT INTO public.users (
    auth_user_id,
    email,
    full_name,
    role,
    company_id,
    is_company_admin
  ) VALUES (
    auth_user_id,
    admin_email,
    admin_full_name,
    'admin',
    new_company_id,
    true
  ) RETURNING id INTO new_user_id;
  
  RETURN json_build_object(
    'success', true, 
    'company_id', new_company_id,
    'user_id', new_user_id,
    'message', 'Company and admin user created successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create trigger to update companies updated_at
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at_trigger
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION update_companies_updated_at();

-- Create trigger to update super_admins updated_at
CREATE TRIGGER update_super_admins_updated_at_trigger
  BEFORE UPDATE ON public.super_admins
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamp();