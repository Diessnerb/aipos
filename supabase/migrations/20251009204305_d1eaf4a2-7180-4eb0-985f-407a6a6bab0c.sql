-- Phase 1: Strengthen RLS Policies for Consistency and Security
-- This migration makes policies MORE restrictive by using the centralized
-- allowed_company_ids_for_current_user() function consistently

-- ============================================================================
-- Update company_settings policies
-- ============================================================================

-- Drop and recreate SELECT policy to use centralized function
DROP POLICY IF EXISTS "Company users can view their company settings" ON public.company_settings;

CREATE POLICY "Company users can view their company settings"
ON public.company_settings
FOR SELECT
TO public
USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Drop and recreate ALL policy to use centralized function with admin check
DROP POLICY IF EXISTS "Company admins can manage their company settings" ON public.company_settings;

CREATE POLICY "Company admins can manage their company settings"
ON public.company_settings
FOR ALL
TO public
USING (
  company_id IN (SELECT allowed_company_ids_for_current_user())
  AND is_current_user_admin()
)
WITH CHECK (
  company_id IN (SELECT allowed_company_ids_for_current_user())
  AND is_current_user_admin()
);

-- ============================================================================
-- Update alisha_company_settings admin policy
-- ============================================================================

-- Drop and recreate ALL policy to use centralized function consistently
DROP POLICY IF EXISTS "Company admins can manage their company settings" ON public.alisha_company_settings;

CREATE POLICY "Company admins can manage their company settings"
ON public.alisha_company_settings
FOR ALL
TO public
USING (
  company_id IN (SELECT allowed_company_ids_for_current_user())
  AND is_current_user_admin()
)
WITH CHECK (
  company_id IN (SELECT allowed_company_ids_for_current_user())
  AND is_current_user_admin()
);

-- ============================================================================
-- Verification: Ensure RLS is still enabled
-- ============================================================================
-- These tables should already have RLS enabled, but let's be explicit
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alisha_company_settings ENABLE ROW LEVEL SECURITY;