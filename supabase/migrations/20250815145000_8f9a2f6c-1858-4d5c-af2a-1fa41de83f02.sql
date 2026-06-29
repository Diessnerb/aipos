-- Phase 2: Drop the problematic function and create minimal policies for owner login

-- Now drop the function since all dependent policies are gone
DROP FUNCTION IF EXISTS public.get_user_company_safe(uuid);
DROP FUNCTION IF EXISTS public.get_current_user_role_safe();
DROP FUNCTION IF EXISTS public.get_current_user_company_id();

-- Create minimal policies ONLY for owner login and super admin functionality

-- 1. Companies table - Only what's needed for owner login
CREATE POLICY "Owner login by email match" ON public.companies
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

CREATE POLICY "Super admin full companies access" ON public.companies
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins sa 
    WHERE sa.user_id = auth.uid()
  )
);

-- 2. Users table - Minimal policies for basic functionality
CREATE POLICY "Users full access temporarily" ON public.users
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Super admin full users access" ON public.users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins sa 
    WHERE sa.user_id = auth.uid()
  )
);

-- 3. Add basic authenticated user policies for other tables to prevent lockout
-- Only adding basic auth policies, no company isolation yet
CREATE POLICY "Basic auth access" ON public.reservations FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.menu_items FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.menu_categories FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.customers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.orders FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.company_settings FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.locations FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.inventory FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.invoices FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.marketing_campaigns FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.messenger_notes FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.channels FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.ai_campaign_logs FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.copilot_logs FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.company_permission_templates FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.integrations FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.holiday_requests FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.rota_entries FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Basic auth access" ON public.rotas FOR ALL USING (auth.uid() IS NOT NULL);