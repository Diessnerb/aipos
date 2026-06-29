-- Fix RLS policies for locations table to allow proper insert/update/select

-- Drop existing RLS policy
DROP POLICY IF EXISTS "locations_company_isolation" ON public.locations;

-- Create new comprehensive RLS policy using the helper function
CREATE POLICY "locations_company_access" ON public.locations
FOR ALL
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));