-- Phase 3: Clean slate - Drop existing minimal policies and recreate them properly

-- Drop any existing policies that might conflict
DROP POLICY IF EXISTS "Owner login by email match" ON public.companies;
DROP POLICY IF EXISTS "Super admin full companies access" ON public.companies;
DROP POLICY IF EXISTS "Users full access temporarily" ON public.users;
DROP POLICY IF EXISTS "Super admin full users access" ON public.users;

-- Drop any existing basic auth policies 
DROP POLICY IF EXISTS "Basic auth access" ON public.reservations;
DROP POLICY IF EXISTS "Basic auth access" ON public.menu_items;
DROP POLICY IF EXISTS "Basic auth access" ON public.menu_categories;
DROP POLICY IF EXISTS "Basic auth access" ON public.customers;
DROP POLICY IF EXISTS "Basic auth access" ON public.orders;
DROP POLICY IF EXISTS "Basic auth access" ON public.company_settings;
DROP POLICY IF EXISTS "Basic auth access" ON public.locations;
DROP POLICY IF EXISTS "Basic auth access" ON public.inventory;
DROP POLICY IF EXISTS "Basic auth access" ON public.invoices;
DROP POLICY IF EXISTS "Basic auth access" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Basic auth access" ON public.messenger_notes;
DROP POLICY IF EXISTS "Basic auth access" ON public.channels;
DROP POLICY IF EXISTS "Basic auth access" ON public.ai_campaign_logs;
DROP POLICY IF EXISTS "Basic auth access" ON public.copilot_logs;
DROP POLICY IF EXISTS "Basic auth access" ON public.company_permission_templates;
DROP POLICY IF EXISTS "Basic auth access" ON public.integrations;
DROP POLICY IF EXISTS "Basic auth access" ON public.holiday_requests;
DROP POLICY IF EXISTS "Basic auth access" ON public.rota_entries;
DROP POLICY IF EXISTS "Basic auth access" ON public.rotas;

-- Now create clean, minimal policies specifically for owner login

-- 1. Companies: Allow owners to view their company by email match
CREATE POLICY "companies_owner_view" ON public.companies
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND default_admin_email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = default_admin_email
  )
);

-- 2. Companies: Super admin access
CREATE POLICY "companies_super_admin" ON public.companies
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins sa 
    WHERE sa.user_id = auth.uid()
  )
);

-- 3. Users: Full access for authenticated users (temporary for testing)
CREATE POLICY "users_authenticated_access" ON public.users
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Essential tables: Basic authenticated access to prevent app lockout
CREATE POLICY "auth_access_reservations" ON public.reservations FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_access_menu_items" ON public.menu_items FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_access_menu_categories" ON public.menu_categories FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_access_customers" ON public.customers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_access_orders" ON public.orders FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_access_company_settings" ON public.company_settings FOR ALL USING (auth.uid() IS NOT NULL);