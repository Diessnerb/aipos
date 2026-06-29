
BEGIN;

-- Ensure the helper function is callable
GRANT EXECUTE ON FUNCTION public.allowed_company_ids_for_current_user() TO authenticated;

-- CUSTOMERS: strict per-company access via helper
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_company_isolation" ON public.customers;
CREATE POLICY "customers_company_isolation_v2"
ON public.customers
AS PERMISSIVE
FOR ALL
TO authenticated
USING (company_id IN (SELECT public.allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT public.allowed_company_ids_for_current_user()));

-- MENU ITEMS: strict per-company access via helper
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_access_menu_items" ON public.menu_items;
CREATE POLICY "menu_items_company_isolation"
ON public.menu_items
AS PERMISSIVE
FOR ALL
TO authenticated
USING (company_id IN (SELECT public.allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT public.allowed_company_ids_for_current_user()));

-- MENU CATEGORIES: strict per-company access via helper
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_access_menu_categories" ON public.menu_categories;
CREATE POLICY "menu_categories_company_isolation"
ON public.menu_categories
AS PERMISSIVE
FOR ALL
TO authenticated
USING (company_id IN (SELECT public.allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT public.allowed_company_ids_for_current_user()));

-- RESERVATIONS: strict per-company access via helper
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_access_reservations" ON public.reservations;
CREATE POLICY "reservations_company_isolation"
ON public.reservations
AS PERMISSIVE
FOR ALL
TO authenticated
USING (company_id IN (SELECT public.allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT public.allowed_company_ids_for_current_user()));

-- COMPANIES: simplify to one safe SELECT policy
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow company lookup by admin email" ON public.companies;
DROP POLICY IF EXISTS "companies_authenticated_view" ON public.companies;
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Users can view their company (safe)" ON public.companies;

CREATE POLICY "companies_select_by_allowed_ids"
ON public.companies
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (id IN (SELECT public.allowed_company_ids_for_current_user()));

-- Keep existing super-admin policy as-is (companies_super_admin)

COMMIT;
