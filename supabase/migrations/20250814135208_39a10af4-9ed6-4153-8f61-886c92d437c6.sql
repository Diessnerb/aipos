-- Phase 1: Add company_id columns to tables missing them

-- Add company_id to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add company_id to menu_categories table
ALTER TABLE public.menu_categories 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add company_id to menu_items table  
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add company_id to inventory table
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add company_id to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add company_id to locations table
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add company_id to marketing_campaigns table
ALTER TABLE public.marketing_campaigns 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add company_id to messenger_notes table
ALTER TABLE public.messenger_notes 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add company_id to channels table
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add company_id to ai_campaign_logs table
ALTER TABLE public.ai_campaign_logs 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add company_id to copilot_logs table
ALTER TABLE public.copilot_logs 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Create trigger functions to auto-set company_id on INSERT
CREATE OR REPLACE FUNCTION public.set_company_id_from_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers to auto-populate company_id
CREATE TRIGGER set_customers_company_id
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

CREATE TRIGGER set_menu_categories_company_id
  BEFORE INSERT ON public.menu_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

CREATE TRIGGER set_menu_items_company_id
  BEFORE INSERT ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

CREATE TRIGGER set_inventory_company_id
  BEFORE INSERT ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

CREATE TRIGGER set_invoices_company_id
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

CREATE TRIGGER set_locations_company_id
  BEFORE INSERT ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

CREATE TRIGGER set_marketing_campaigns_company_id
  BEFORE INSERT ON public.marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

CREATE TRIGGER set_messenger_notes_company_id
  BEFORE INSERT ON public.messenger_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

CREATE TRIGGER set_channels_company_id
  BEFORE INSERT ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

CREATE TRIGGER set_ai_campaign_logs_company_id
  BEFORE INSERT ON public.ai_campaign_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

CREATE TRIGGER set_copilot_logs_company_id
  BEFORE INSERT ON public.copilot_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();

-- Phase 2: Update RLS policies to ensure company data isolation

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.customers;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.customers;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.customers;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.customers;

DROP POLICY IF EXISTS "Allow all operations on locations" ON public.locations;

-- Create company-scoped RLS policies for customers
CREATE POLICY "Company users can view their company customers"
ON public.customers FOR SELECT
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can insert their company customers"
ON public.customers FOR INSERT
WITH CHECK (company_id = get_user_company_safe());

CREATE POLICY "Company users can update their company customers"
ON public.customers FOR UPDATE
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can delete their company customers"
ON public.customers FOR DELETE
USING (company_id = get_user_company_safe());

-- Create company-scoped RLS policies for locations
CREATE POLICY "Company users can view their company locations"
ON public.locations FOR SELECT
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can insert their company locations"
ON public.locations FOR INSERT
WITH CHECK (company_id = get_user_company_safe());

CREATE POLICY "Company users can update their company locations"
ON public.locations FOR UPDATE
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can delete their company locations"
ON public.locations FOR DELETE
USING (company_id = get_user_company_safe());

-- Update menu_categories RLS policies
CREATE POLICY "Company users can view their company menu categories"
ON public.menu_categories FOR SELECT
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can insert their company menu categories"
ON public.menu_categories FOR INSERT
WITH CHECK (company_id = get_user_company_safe());

CREATE POLICY "Company users can update their company menu categories"
ON public.menu_categories FOR UPDATE
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can delete their company menu categories"
ON public.menu_categories FOR DELETE
USING (company_id = get_user_company_safe());

-- Update menu_items RLS policies
CREATE POLICY "Company users can view their company menu items"
ON public.menu_items FOR SELECT
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can insert their company menu items"
ON public.menu_items FOR INSERT
WITH CHECK (company_id = get_user_company_safe());

CREATE POLICY "Company users can update their company menu items"
ON public.menu_items FOR UPDATE
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can delete their company menu items"
ON public.menu_items FOR DELETE
USING (company_id = get_user_company_safe());

-- Create company-scoped RLS policies for inventory
CREATE POLICY "Company users can view their company inventory"
ON public.inventory FOR SELECT
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can insert their company inventory"
ON public.inventory FOR INSERT
WITH CHECK (company_id = get_user_company_safe());

CREATE POLICY "Company users can update their company inventory"
ON public.inventory FOR UPDATE
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can delete their company inventory"
ON public.inventory FOR DELETE
USING (company_id = get_user_company_safe());

-- Create company-scoped RLS policies for invoices
CREATE POLICY "Company users can view their company invoices"
ON public.invoices FOR SELECT
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can insert their company invoices"
ON public.invoices FOR INSERT
WITH CHECK (company_id = get_user_company_safe());

CREATE POLICY "Company users can update their company invoices"
ON public.invoices FOR UPDATE
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can delete their company invoices"
ON public.invoices FOR DELETE
USING (company_id = get_user_company_safe());

-- Create company-scoped RLS policies for marketing_campaigns
CREATE POLICY "Company users can view their company marketing campaigns"
ON public.marketing_campaigns FOR SELECT
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can insert their company marketing campaigns"
ON public.marketing_campaigns FOR INSERT
WITH CHECK (company_id = get_user_company_safe());

CREATE POLICY "Company users can update their company marketing campaigns"
ON public.marketing_campaigns FOR UPDATE
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can delete their company marketing campaigns"
ON public.marketing_campaigns FOR DELETE
USING (company_id = get_user_company_safe());

-- Create company-scoped RLS policies for messenger_notes
CREATE POLICY "Company users can view their company messenger notes"
ON public.messenger_notes FOR SELECT
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can insert their company messenger notes"
ON public.messenger_notes FOR INSERT
WITH CHECK (company_id = get_user_company_safe());

CREATE POLICY "Company users can update their company messenger notes"
ON public.messenger_notes FOR UPDATE
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can delete their company messenger notes"
ON public.messenger_notes FOR DELETE
USING (company_id = get_user_company_safe());

-- Create company-scoped RLS policies for channels
CREATE POLICY "Company users can view their company channels"
ON public.channels FOR SELECT
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can insert their company channels"
ON public.channels FOR INSERT
WITH CHECK (company_id = get_user_company_safe());

CREATE POLICY "Company users can update their company channels"
ON public.channels FOR UPDATE
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can delete their company channels"
ON public.channels FOR DELETE
USING (company_id = get_user_company_safe());

-- Create company-scoped RLS policies for ai_campaign_logs
CREATE POLICY "Company users can view their company ai campaign logs"
ON public.ai_campaign_logs FOR SELECT
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can insert their company ai campaign logs"
ON public.ai_campaign_logs FOR INSERT
WITH CHECK (company_id = get_user_company_safe());

CREATE POLICY "Company users can update their company ai campaign logs"
ON public.ai_campaign_logs FOR UPDATE
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can delete their company ai campaign logs"
ON public.ai_campaign_logs FOR DELETE
USING (company_id = get_user_company_safe());

-- Create company-scoped RLS policies for copilot_logs
CREATE POLICY "Company users can view their company copilot logs"
ON public.copilot_logs FOR SELECT
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can insert their company copilot logs"
ON public.copilot_logs FOR INSERT
WITH CHECK (company_id = get_user_company_safe());

CREATE POLICY "Company users can update their company copilot logs"
ON public.copilot_logs FOR UPDATE
USING (company_id = get_user_company_safe());

CREATE POLICY "Company users can delete their company copilot logs"
ON public.copilot_logs FOR DELETE
USING (company_id = get_user_company_safe());

-- Add super admin policies for all new tables
CREATE POLICY "Super admins can manage all customers"
ON public.customers FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage all locations"
ON public.locations FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage all inventory"
ON public.inventory FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage all invoices"
ON public.invoices FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage all marketing campaigns"
ON public.marketing_campaigns FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage all messenger notes"
ON public.messenger_notes FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage all channels"
ON public.channels FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage all ai campaign logs"
ON public.ai_campaign_logs FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage all copilot logs"
ON public.copilot_logs FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());