-- Add missing columns to suppliers table
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS order_method TEXT NOT NULL DEFAULT 'phone',
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS minimum_order_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add index on company_id for faster queries
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers(company_id);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for company isolation
DROP POLICY IF EXISTS suppliers_company_isolation ON public.suppliers;
CREATE POLICY suppliers_company_isolation ON public.suppliers
  FOR ALL
  USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS suppliers_updated_at_trigger ON public.suppliers;
CREATE TRIGGER suppliers_updated_at_trigger
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_suppliers_updated_at();

-- Add comments
COMMENT ON COLUMN public.suppliers.scheduling_mode IS 'Scheduling mode: lead_time or fixed_schedule';
COMMENT ON COLUMN public.suppliers.lead_time_days IS 'Number of days lead time when scheduling_mode is lead_time';
COMMENT ON TABLE public.suppliers IS 'Supplier information with delivery scheduling support';

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;