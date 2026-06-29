-- Re-enable Row Level Security on the tables table and ensure policies are correct
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to recreate them
DROP POLICY IF EXISTS "Users can view tables from their company" ON public.tables;
DROP POLICY IF EXISTS "Admins and managers can insert tables" ON public.tables;
DROP POLICY IF EXISTS "Admins and managers can update tables" ON public.tables;
DROP POLICY IF EXISTS "Admins and managers can delete tables" ON public.tables;

-- Create RLS policies for tables with auth.uid() references fixed
CREATE POLICY "Users can view tables from their company" 
  ON public.tables 
  FOR SELECT 
  USING (company_id = (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admins and managers can insert tables" 
  ON public.tables 
  FOR INSERT 
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()) 
    AND (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'manager')
  );

CREATE POLICY "Admins and managers can update tables" 
  ON public.tables 
  FOR UPDATE 
  USING (
    company_id = (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()) 
    AND (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'manager')
  );

CREATE POLICY "Admins and managers can delete tables" 
  ON public.tables 
  FOR DELETE 
  USING (
    company_id = (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()) 
    AND (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) IN ('admin', 'manager')
  );