-- Nuclear Option: Complete RLS Reset - Drop ALL policies that depend on get_user_company_safe
-- Phase 1: Drop all dependent policies across all tables

-- Drop ALL policies from reservations table
DROP POLICY IF EXISTS "Company users can manage their company reservations" ON public.reservations;

-- Drop ALL policies from tables table
DROP POLICY IF EXISTS "Company users can manage their company tables" ON public.tables;

-- Drop ALL policies from holiday_requests table
DROP POLICY IF EXISTS "Users can view holiday requests in their company" ON public.holiday_requests;
DROP POLICY IF EXISTS "Users can manage their own holiday requests" ON public.holiday_requests;

-- Drop ALL policies from rota_entries table
DROP POLICY IF EXISTS "Company users can view rota entries in their company" ON public.rota_entries;
DROP POLICY IF EXISTS "Company managers can manage rota entries" ON public.rota_entries;

-- Drop ALL policies from rotas table
DROP POLICY IF EXISTS "Company users can view rotas in their company" ON public.rotas;
DROP POLICY IF EXISTS "Company managers can manage rotas" ON public.rotas;

-- Drop ALL policies from company_settings table
DROP POLICY IF EXISTS "Company users can view their company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Company admins can update their company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Company admins/managers can insert their company settings" ON public.company_settings;

-- Drop ALL policies from customers table
DROP POLICY IF EXISTS "Company users can view their company customers" ON public.customers;
DROP POLICY IF EXISTS "Company users can insert their company customers" ON public.customers;
DROP POLICY IF EXISTS "Company users can update their company customers" ON public.customers;
DROP POLICY IF EXISTS "Company users can delete their company customers" ON public.customers;

-- Drop ALL policies from locations table
DROP POLICY IF EXISTS "Company users can view their company locations" ON public.locations;
DROP POLICY IF EXISTS "Company users can insert their company locations" ON public.locations;
DROP POLICY IF EXISTS "Company users can update their company locations" ON public.locations;
DROP POLICY IF EXISTS "Company users can delete their company locations" ON public.locations;

-- Drop ALL policies from menu_categories table
DROP POLICY IF EXISTS "Company users can view their company menu categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Company users can insert their company menu categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Company users can update their company menu categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Company users can delete their company menu categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Authenticated users can insert menu categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Authenticated users can update menu categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Authenticated users can delete menu categories" ON public.menu_categories;

-- Drop ALL policies from menu_items table
DROP POLICY IF EXISTS "Company users can view their company menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Company users can insert their company menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Company users can update their company menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Company users can delete their company menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Authenticated users can insert menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Authenticated users can update menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Authenticated users can delete menu items" ON public.menu_items;

-- Drop ALL policies from inventory table
DROP POLICY IF EXISTS "Company users can view their company inventory" ON public.inventory;
DROP POLICY IF EXISTS "Company users can insert their company inventory" ON public.inventory;
DROP POLICY IF EXISTS "Company users can update their company inventory" ON public.inventory;
DROP POLICY IF EXISTS "Company users can delete their company inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users can manage inventory" ON public.inventory;

-- Drop ALL policies from invoices table
DROP POLICY IF EXISTS "Company users can view their company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Company users can insert their company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Company users can update their company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Company users can delete their company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can manage invoices" ON public.invoices;

-- Drop ALL policies from marketing_campaigns table
DROP POLICY IF EXISTS "Company users can view their company marketing campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Company users can insert their company marketing campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Company users can update their company marketing campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Company users can delete their company marketing campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Authenticated users can manage marketing campaigns" ON public.marketing_campaigns;

-- Drop ALL policies from messenger_notes table
DROP POLICY IF EXISTS "Company users can view their company messenger notes" ON public.messenger_notes;
DROP POLICY IF EXISTS "Company users can insert their company messenger notes" ON public.messenger_notes;
DROP POLICY IF EXISTS "Company users can update their company messenger notes" ON public.messenger_notes;
DROP POLICY IF EXISTS "Company users can delete their company messenger notes" ON public.messenger_notes;
DROP POLICY IF EXISTS "Authenticated users can manage messenger notes" ON public.messenger_notes;

-- Drop ALL policies from channels table
DROP POLICY IF EXISTS "Company users can view their company channels" ON public.channels;
DROP POLICY IF EXISTS "Company users can insert their company channels" ON public.channels;
DROP POLICY IF EXISTS "Company users can update their company channels" ON public.channels;
DROP POLICY IF EXISTS "Company users can delete their company channels" ON public.channels;
DROP POLICY IF EXISTS "Authenticated users can manage channels" ON public.channels;

-- Drop ALL policies from ai_campaign_logs table
DROP POLICY IF EXISTS "Company users can view their company ai campaign logs" ON public.ai_campaign_logs;
DROP POLICY IF EXISTS "Company users can insert their company ai campaign logs" ON public.ai_campaign_logs;
DROP POLICY IF EXISTS "Company users can update their company ai campaign logs" ON public.ai_campaign_logs;
DROP POLICY IF EXISTS "Company users can delete their company ai campaign logs" ON public.ai_campaign_logs;
DROP POLICY IF EXISTS "Authenticated users can manage ai campaign logs" ON public.ai_campaign_logs;

-- Drop ALL policies from copilot_logs table
DROP POLICY IF EXISTS "Company users can view their company copilot logs" ON public.copilot_logs;
DROP POLICY IF EXISTS "Company users can insert their company copilot logs" ON public.copilot_logs;
DROP POLICY IF EXISTS "Company users can update their company copilot logs" ON public.copilot_logs;
DROP POLICY IF EXISTS "Company users can delete their company copilot logs" ON public.copilot_logs;
DROP POLICY IF EXISTS "Authenticated users can manage copilot logs" ON public.copilot_logs;

-- Drop ALL policies from company_permission_templates table
DROP POLICY IF EXISTS "Company admins can manage their company templates" ON public.company_permission_templates;
DROP POLICY IF EXISTS "Company users can view their company templates" ON public.company_permission_templates;

-- Drop ALL policies from integrations table
DROP POLICY IF EXISTS "Company admins can manage integrations" ON public.integrations;

-- Drop ALL policies from users table (including the admin one)
DROP POLICY IF EXISTS "Company admins can manage users in their company" ON public.users;
DROP POLICY IF EXISTS "Owner can view company by email" ON public.companies;
DROP POLICY IF EXISTS "Super admins manage companies" ON public.companies;
DROP POLICY IF EXISTS "Allow user creation" ON public.users;
DROP POLICY IF EXISTS "Users see own record" ON public.users;
DROP POLICY IF EXISTS "Users update own record" ON public.users;
DROP POLICY IF EXISTS "Users delete own record" ON public.users;
DROP POLICY IF EXISTS "Super admins manage users" ON public.users;