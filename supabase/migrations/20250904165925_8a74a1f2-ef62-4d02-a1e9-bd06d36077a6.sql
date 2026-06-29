-- CRITICAL SECURITY FIX: Implement proper RLS policies for all sensitive tables
-- This migration addresses the critical security vulnerabilities found in the security scan

-- 1. FIX USERS TABLE - Currently has NO RLS policies (CRITICAL)
-- Drop any existing permissive policies first
DROP POLICY IF EXISTS "Authenticated users can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can view all users" ON public.users;

-- Create secure RLS policies for users table
CREATE POLICY "Users can view their own profile" 
ON public.users 
FOR SELECT 
USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own profile" 
ON public.users 
FOR UPDATE 
USING (auth.uid() = auth_user_id);

CREATE POLICY "Company admins can view company users" 
ON public.users 
FOR SELECT 
USING (
  company_id IN (
    SELECT u.company_id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND (u.role = 'admin' OR u.is_company_admin = true)
  )
);

CREATE POLICY "Company admins can manage company users" 
ON public.users 
FOR ALL 
USING (
  company_id IN (
    SELECT u.company_id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND (u.role = 'admin' OR u.is_company_admin = true)
  )
);

CREATE POLICY "Super admins can manage all users" 
ON public.users 
FOR ALL 
USING (public.is_current_user_super_admin());

-- 2. FIX CUSTOMERS TABLE - Ensure proper company isolation
DROP POLICY IF EXISTS "Authenticated users can manage customers" ON public.customers;

-- Replace with proper company-scoped access
CREATE POLICY "Company users can view company customers" 
ON public.customers 
FOR SELECT 
USING (
  company_id IN (
    SELECT u.company_id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Company users can manage company customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT u.company_id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Company users can update company customers" 
ON public.customers 
FOR UPDATE 
USING (
  company_id IN (
    SELECT u.company_id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Company users can delete company customers" 
ON public.customers 
FOR DELETE 
USING (
  company_id IN (
    SELECT u.company_id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

-- 3. SECURE ORDERS AND PAYMENTS - Remove overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage order items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can manage payments" ON public.payments;
DROP POLICY IF EXISTS "auth_access_orders" ON public.orders;

-- Create company-scoped order access
CREATE POLICY "Company users can view company orders" 
ON public.orders 
FOR SELECT 
USING (
  created_by IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
    OR u.company_id IN (
      SELECT u2.company_id 
      FROM public.users u2 
      WHERE u2.auth_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Company users can manage company orders" 
ON public.orders 
FOR ALL 
USING (
  created_by IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.company_id IN (
      SELECT u2.company_id 
      FROM public.users u2 
      WHERE u2.auth_user_id = auth.uid()
    )
  )
);

-- Secure order items
CREATE POLICY "Company users can view company order items" 
ON public.order_items 
FOR SELECT 
USING (
  order_id IN (
    SELECT o.id 
    FROM public.orders o 
    JOIN public.users u ON o.created_by = u.id 
    WHERE u.company_id IN (
      SELECT u2.company_id 
      FROM public.users u2 
      WHERE u2.auth_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Company users can manage company order items" 
ON public.order_items 
FOR ALL 
USING (
  order_id IN (
    SELECT o.id 
    FROM public.orders o 
    JOIN public.users u ON o.created_by = u.id 
    WHERE u.company_id IN (
      SELECT u2.company_id 
      FROM public.users u2 
      WHERE u2.auth_user_id = auth.uid()
    )
  )
);

-- Secure payments
CREATE POLICY "Company users can view company payments" 
ON public.payments 
FOR SELECT 
USING (
  order_id IN (
    SELECT o.id 
    FROM public.orders o 
    JOIN public.users u ON o.created_by = u.id 
    WHERE u.company_id IN (
      SELECT u2.company_id 
      FROM public.users u2 
      WHERE u2.auth_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Company users can manage company payments" 
ON public.payments 
FOR ALL 
USING (
  order_id IN (
    SELECT o.id 
    FROM public.orders o 
    JOIN public.users u ON o.created_by = u.id 
    WHERE u.company_id IN (
      SELECT u2.company_id 
      FROM public.users u2 
      WHERE u2.auth_user_id = auth.uid()
    )
  )
);

-- 4. SECURE MESSAGING SYSTEM - Remove overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can manage channel memberships" ON public.channel_memberships;

-- Create proper message access policies
CREATE POLICY "Users can view messages in their channels" 
ON public.messages 
FOR SELECT 
USING (
  channel_id IN (
    SELECT cm.channel_id 
    FROM public.channel_memberships cm 
    WHERE cm.user_id IN (
      SELECT u.id 
      FROM public.users u 
      WHERE u.auth_user_id = auth.uid()
    )
  ) 
  OR recipient_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
  OR user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages to their channels" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
  AND (
    channel_id IN (
      SELECT cm.channel_id 
      FROM public.channel_memberships cm 
      WHERE cm.user_id IN (
        SELECT u.id 
        FROM public.users u 
        WHERE u.auth_user_id = auth.uid()
      ) 
      AND cm.can_write = true
    ) 
    OR recipient_id IS NOT NULL
  )
);

-- Secure channel memberships
CREATE POLICY "Users can view their own channel memberships" 
ON public.channel_memberships 
FOR SELECT 
USING (
  user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Channel creators can manage memberships" 
ON public.channel_memberships 
FOR ALL 
USING (
  channel_id IN (
    SELECT c.id 
    FROM public.channels c 
    WHERE c.created_by = auth.uid()
  )
);

-- 5. SECURE ADDITIONAL SENSITIVE TABLES
-- Remove overly permissive policies from other tables
DROP POLICY IF EXISTS "Authenticated users can manage inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Authenticated users can manage menu item ingredients" ON public.menu_item_ingredients;
DROP POLICY IF EXISTS "Authenticated users can manage off reasons" ON public.off_reasons;
DROP POLICY IF EXISTS "Authenticated users can manage shift approval requests" ON public.shift_approval_requests;
DROP POLICY IF EXISTS "Authenticated users can manage shift swap requests" ON public.shift_swap_requests;
DROP POLICY IF EXISTS "Authenticated users can manage shift logs" ON public.shift_logs;
DROP POLICY IF EXISTS "Authenticated users can manage supplier order items" ON public.supplier_order_items;

-- Replace with company-scoped policies for inventory logs
CREATE POLICY "Company users can view company inventory logs" 
ON public.inventory_logs 
FOR SELECT 
USING (
  inventory_item_id IN (
    SELECT i.id 
    FROM public.inventory i 
    WHERE i.company_id IN (
      SELECT u.company_id 
      FROM public.users u 
      WHERE u.auth_user_id = auth.uid()
    )
  )
);

-- 6. FIX FUNCTION SECURITY DEFINER ISSUES
-- Update functions to have proper search_path set
CREATE OR REPLACE FUNCTION public.get_user_company_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id 
  FROM public.users 
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- Update the allowed_company_ids function
CREATE OR REPLACE FUNCTION public.allowed_company_ids_for_current_user()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- From user's linked company (preferred)
  select u.company_id
  from public.users u
  where u.auth_user_id = auth.uid() and u.company_id is not null

  union

  -- From admin email match (fallback for company admins)
  select c.id
  from public.companies c
  where c.default_admin_email = (
    select au.email from auth.users au where au.id = auth.uid()
  );
$$;

-- 7. SECURE COMPANY SETTINGS ACCESS
DROP POLICY IF EXISTS "auth_access_company_settings" ON public.company_settings;

CREATE POLICY "Company users can view their company settings" 
ON public.company_settings 
FOR SELECT 
USING (
  company_id IN (
    SELECT u.company_id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Company admins can manage their company settings" 
ON public.company_settings 
FOR ALL 
USING (
  company_id IN (
    SELECT u.company_id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND (u.role = 'admin' OR u.is_company_admin = true)
  )
);

-- 8. ADD SECURITY LOGGING FOR CRITICAL OPERATIONS
INSERT INTO public.security_audit_log (action, resource_type, details)
VALUES ('CRITICAL_SECURITY_FIX', 'SYSTEM', json_build_object(
  'description', 'Applied comprehensive RLS security fixes',
  'timestamp', now(),
  'affected_tables', ARRAY[
    'users', 'customers', 'orders', 'order_items', 'payments', 
    'messages', 'channel_memberships', 'company_settings', 'inventory_logs'
  ]
));