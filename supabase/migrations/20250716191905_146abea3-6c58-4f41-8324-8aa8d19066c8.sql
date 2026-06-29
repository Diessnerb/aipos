-- Remove all RLS policies and disable RLS on all tables

-- Disable RLS on all tables that currently have it enabled
ALTER TABLE public.company_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_ingredients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.off_reasons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_approval_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_swap_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies
-- Company Settings
DROP POLICY IF EXISTS "Allow public insert access to company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Allow public read access to company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Allow public update access to company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Anyone can view company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Authenticated users can update company settings" ON public.company_settings;

-- Copilot Logs
DROP POLICY IF EXISTS "Users can read/write their own messages" ON public.copilot_logs;

-- Customers
DROP POLICY IF EXISTS "Admins can access all customers" ON public.customers;
DROP POLICY IF EXISTS "All authenticated users can view customers" ON public.customers;

-- Holiday Requests
DROP POLICY IF EXISTS "Admins and managers can update holiday requests" ON public.holiday_requests;
DROP POLICY IF EXISTS "Admins and managers can view all holiday requests" ON public.holiday_requests;
DROP POLICY IF EXISTS "Admins can update holiday requests" ON public.holiday_requests;
DROP POLICY IF EXISTS "Admins can view all holiday requests" ON public.holiday_requests;
DROP POLICY IF EXISTS "Users can create their own holiday requests" ON public.holiday_requests;
DROP POLICY IF EXISTS "Users can view their own holiday requests" ON public.holiday_requests;

-- Integrations
DROP POLICY IF EXISTS "Company can read/write its integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can create their own integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can delete their own integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can update their own integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can view their own integrations" ON public.integrations;

-- Inventory
DROP POLICY IF EXISTS "Admins have full access to inventory" ON public.inventory;
DROP POLICY IF EXISTS "Managers can update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Staff and managers can view inventory" ON public.inventory;

-- Inventory Logs
DROP POLICY IF EXISTS "Allow all operations on inventory_logs" ON public.inventory_logs;

-- Menu Item Ingredients
DROP POLICY IF EXISTS "Allow all operations on menu_item_ingredients" ON public.menu_item_ingredients;

-- Messages
DROP POLICY IF EXISTS "Users can send channel messages where they have write access" ON public.messages;
DROP POLICY IF EXISTS "Users can send direct messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view channel messages they belong to" ON public.messages;
DROP POLICY IF EXISTS "Users can view direct messages sent to or from them" ON public.messages;

-- Messenger Notes
DROP POLICY IF EXISTS "All authenticated users can access staff notes" ON public.messenger_notes;

-- Off Reasons
DROP POLICY IF EXISTS "Users can delete their own off reasons" ON public.off_reasons;
DROP POLICY IF EXISTS "Users can insert their own off reasons" ON public.off_reasons;
DROP POLICY IF EXISTS "Users can read their own off reasons" ON public.off_reasons;
DROP POLICY IF EXISTS "Users can update their own off reasons" ON public.off_reasons;

-- Orders
DROP POLICY IF EXISTS "Admins can access all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins have full access to orders" ON public.orders;
DROP POLICY IF EXISTS "Allow anonymous order operations" ON public.orders;
DROP POLICY IF EXISTS "Allow order insertion for authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Allow order updates" ON public.orders;
DROP POLICY IF EXISTS "Allow order viewing" ON public.orders;
DROP POLICY IF EXISTS "Managers and admins full access" ON public.orders;
DROP POLICY IF EXISTS "Managers can access all company orders" ON public.orders;
DROP POLICY IF EXISTS "Staff access own orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can access orders" ON public.orders;

-- Reservations
DROP POLICY IF EXISTS "Admins can view all reservations" ON public.reservations;
DROP POLICY IF EXISTS "Admins have full access to reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow authenticated users to create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow authenticated users to delete reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow authenticated users to update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow authenticated users to view reservations" ON public.reservations;
DROP POLICY IF EXISTS "Managers can access all company reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff can access their own reservations" ON public.reservations;

-- Rota Entries
DROP POLICY IF EXISTS "Admins and managers can manage rota entries" ON public.rota_entries;
DROP POLICY IF EXISTS "Admins and managers can view all rota entries" ON public.rota_entries;
DROP POLICY IF EXISTS "Admins can manage all rota entries" ON public.rota_entries;
DROP POLICY IF EXISTS "Users can view entries from published rotas" ON public.rota_entries;
DROP POLICY IF EXISTS "Users can view published rota entries" ON public.rota_entries;
DROP POLICY IF EXISTS "Users can view their own rota entries" ON public.rota_entries;

-- Rotas
DROP POLICY IF EXISTS "Admins and managers can manage rotas" ON public.rotas;
DROP POLICY IF EXISTS "Admins and managers can view all rotas" ON public.rotas;
DROP POLICY IF EXISTS "Admins can manage all rotas" ON public.rotas;
DROP POLICY IF EXISTS "Admins have full access to rotas" ON public.rotas;
DROP POLICY IF EXISTS "All users can view published rotas" ON public.rotas;
DROP POLICY IF EXISTS "Managers can manage rotas" ON public.rotas;
DROP POLICY IF EXISTS "Staff and managers can view rotas" ON public.rotas;
DROP POLICY IF EXISTS "Users can view published rotas" ON public.rotas;

-- Shift Approval Requests
DROP POLICY IF EXISTS "Managers/admins can approve/reject approval requests" ON public.shift_approval_requests;
DROP POLICY IF EXISTS "Users and managers can view relevant approval requests" ON public.shift_approval_requests;

-- Shift Swap Requests
DROP POLICY IF EXISTS "Managers can approve shift requests" ON public.shift_swap_requests;
DROP POLICY IF EXISTS "Users can create shift requests" ON public.shift_swap_requests;
DROP POLICY IF EXISTS "Users can delete their own shift swap requests" ON public.shift_swap_requests;
DROP POLICY IF EXISTS "Users can update shift requests they are involved in" ON public.shift_swap_requests;
DROP POLICY IF EXISTS "Users can view all shift swap requests" ON public.shift_swap_requests;

-- Tables
DROP POLICY IF EXISTS "Users can view tables from their company" ON public.tables;
DROP POLICY IF EXISTS "Admins and managers can insert tables" ON public.tables;
DROP POLICY IF EXISTS "Admins and managers can update tables" ON public.tables;
DROP POLICY IF EXISTS "Admins and managers can delete tables" ON public.tables;

-- Users
DROP POLICY IF EXISTS "Allow authenticated users to delete users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to insert users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to update users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to view all users" ON public.users;