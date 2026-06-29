-- Phase 1: Create Database Triggers for Auto Company Linking

-- Trigger for customers table
CREATE OR REPLACE FUNCTION public.set_customer_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM users WHERE auth_user_id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_customer_company_id_trigger ON public.customers;
CREATE TRIGGER set_customer_company_id_trigger
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_company_id();

-- Trigger for inventory table  
CREATE OR REPLACE FUNCTION public.set_inventory_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM users WHERE auth_user_id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_inventory_company_id_trigger ON public.inventory;
CREATE TRIGGER set_inventory_company_id_trigger
  BEFORE INSERT ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.set_inventory_company_id();

-- Trigger for invoices table
CREATE OR REPLACE FUNCTION public.set_invoice_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM users WHERE auth_user_id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_invoice_company_id_trigger ON public.invoices;
CREATE TRIGGER set_invoice_company_id_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_company_id();

-- Trigger for locations table
CREATE OR REPLACE FUNCTION public.set_location_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM users WHERE auth_user_id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_location_company_id_trigger ON public.locations;
CREATE TRIGGER set_location_company_id_trigger
  BEFORE INSERT ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_location_company_id();

-- Trigger for marketing campaigns table
CREATE OR REPLACE FUNCTION public.set_marketing_campaign_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM users WHERE auth_user_id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_marketing_campaign_company_id_trigger ON public.marketing_campaigns;
CREATE TRIGGER set_marketing_campaign_company_id_trigger
  BEFORE INSERT ON public.marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_marketing_campaign_company_id();

-- Trigger for channels table
CREATE OR REPLACE FUNCTION public.set_channel_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM users WHERE auth_user_id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_channel_company_id_trigger ON public.channels;
CREATE TRIGGER set_channel_company_id_trigger
  BEFORE INSERT ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_channel_company_id();

-- Trigger for messenger_notes table
CREATE OR REPLACE FUNCTION public.set_messenger_note_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM users WHERE auth_user_id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_messenger_note_company_id_trigger ON public.messenger_notes;
CREATE TRIGGER set_messenger_note_company_id_trigger
  BEFORE INSERT ON public.messenger_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_messenger_note_company_id();

-- Phase 2: Fix Existing Data Migration

-- Update reservations without company_id
UPDATE public.reservations 
SET company_id = (
  SELECT u.company_id 
  FROM public.users u 
  WHERE u.id = reservations.created_by
  LIMIT 1
)
WHERE company_id IS NULL AND created_by IS NOT NULL;

-- For reservations still without company_id, try to link via admin email
UPDATE public.reservations 
SET company_id = (
  SELECT c.id 
  FROM public.companies c 
  WHERE c.default_admin_email IS NOT NULL 
  LIMIT 1
)
WHERE company_id IS NULL;

-- Update customers without company_id
UPDATE public.customers 
SET company_id = (
  SELECT c.id 
  FROM public.companies c 
  WHERE c.status = 'active'
  LIMIT 1
)
WHERE company_id IS NULL;

-- Update inventory without company_id
UPDATE public.inventory 
SET company_id = (
  SELECT c.id 
  FROM public.companies c 
  WHERE c.status = 'active'
  LIMIT 1
)
WHERE company_id IS NULL;

-- Phase 4: Enhanced RLS Policies for Company Isolation

-- Update customers RLS policy for better company isolation
DROP POLICY IF EXISTS "auth_access_customers" ON public.customers;
CREATE POLICY "customers_company_isolation" ON public.customers
FOR ALL
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
);

-- Update inventory RLS policy for company isolation
DROP POLICY IF EXISTS "Authenticated users can manage inventory" ON public.inventory;
CREATE POLICY "inventory_company_isolation" ON public.inventory
FOR ALL
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
);

-- Update tables RLS policy for company isolation
DROP POLICY IF EXISTS "Authenticated users can manage tables" ON public.tables;
CREATE POLICY "tables_company_isolation" ON public.tables
FOR ALL
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
);

-- Update locations RLS policy
DROP POLICY IF EXISTS "Authenticated users can manage locations" ON public.locations;
CREATE POLICY "locations_company_isolation" ON public.locations
FOR ALL
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
);

-- Update marketing campaigns RLS policy
DROP POLICY IF EXISTS "Authenticated users can manage marketing campaigns" ON public.marketing_campaigns;
CREATE POLICY "marketing_campaigns_company_isolation" ON public.marketing_campaigns
FOR ALL
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
);

-- Update invoices RLS policy
DROP POLICY IF EXISTS "Authenticated users can manage invoices" ON public.invoices;
CREATE POLICY "invoices_company_isolation" ON public.invoices
FOR ALL
USING (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT u.company_id FROM public.users u WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id FROM public.companies c WHERE c.default_admin_email IN (
      SELECT au.email FROM auth.users au WHERE au.id = auth.uid()
    )
  )
);