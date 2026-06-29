-- Fix circular dependency in super_admins RLS policies
-- The issue: RLS policies require super admin status to read super_admins table,
-- but checking super admin status requires reading from super_admins table

-- Drop existing restrictive policies that cause circular dependency
DROP POLICY IF EXISTS "Super admins can manage all super admins" ON public.super_admins;

-- Create new policies that break the circular dependency
-- Allow any authenticated user to read super admin records (needed for is_super_admin check)
CREATE POLICY "Authenticated users can read super admin records" 
ON public.super_admins 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Restrict write operations to existing super admins only
CREATE POLICY "Only super admins can insert super admin records" 
ON public.super_admins 
FOR INSERT 
WITH CHECK (is_super_admin());

CREATE POLICY "Only super admins can update super admin records" 
ON public.super_admins 
FOR UPDATE 
USING (is_super_admin());

CREATE POLICY "Only super admins can delete super admin records" 
ON public.super_admins 
FOR DELETE 
USING (is_super_admin());

-- Ensure the is_super_admin function uses SECURITY DEFINER to bypass RLS if needed
CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = user_uuid
  );
$function$;