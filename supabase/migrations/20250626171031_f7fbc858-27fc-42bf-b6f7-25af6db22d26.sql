
-- Create a tables table to store restaurant table information
CREATE TABLE IF NOT EXISTS public.tables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_number integer NOT NULL,
  table_name text,
  seats integer DEFAULT 4,
  location text,
  status text DEFAULT 'available',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid REFERENCES public.companies(id),
  UNIQUE(table_number, company_id)
);

-- Enable Row Level Security
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tables
CREATE POLICY "Users can view tables from their company" 
  ON public.tables 
  FOR SELECT 
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Admins and managers can insert tables" 
  ON public.tables 
  FOR INSERT 
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()) 
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager')
  );

CREATE POLICY "Admins and managers can update tables" 
  ON public.tables 
  FOR UPDATE 
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()) 
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager')
  );

CREATE POLICY "Admins and managers can delete tables" 
  ON public.tables 
  FOR DELETE 
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()) 
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- Insert some default tables (T1-T25) for existing companies

-- Injected unique constraint for ON CONFLICT by repair script
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS uniq_tables_table_number_company_id;
ALTER TABLE public.tables ADD CONSTRAINT uniq_tables_table_number_company_id UNIQUE (table_number,company_id);

INSERT INTO public.tables (table_number, table_name, seats, company_id)
SELECT 
  generate_series(1, 25) as table_number,
  'T' || generate_series(1, 25) as table_name,
  4 as seats,
  c.id as company_id
FROM public.companies c
ON CONFLICT (table_number, company_id) DO NOTHING;
