-- Create supplier_categories table
CREATE TABLE IF NOT EXISTS public.supplier_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_scheme TEXT NOT NULL DEFAULT 'gray',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- Create indexes
CREATE INDEX idx_supplier_categories_company_id ON public.supplier_categories(company_id);
CREATE INDEX idx_supplier_categories_name ON public.supplier_categories(name);

-- Enable RLS
ALTER TABLE public.supplier_categories ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY supplier_categories_company_isolation ON public.supplier_categories
  FOR ALL
  USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Seed default categories for all existing companies

-- Injected unique constraint for ON CONFLICT by repair script
-- Delete duplicate rows before adding constraint to avoid unique violation
DELETE FROM public.supplier_categories a USING public.supplier_categories b WHERE a.ctid < b.ctid AND a.company_id = b.company_id AND a.name = b.name;
ALTER TABLE public.supplier_categories DROP CONSTRAINT IF EXISTS uniq_supplier_categories_company_id_name;
ALTER TABLE public.supplier_categories ADD CONSTRAINT uniq_supplier_categories_company_id_name UNIQUE (company_id,name);

INSERT INTO public.supplier_categories (company_id, name, color_scheme, is_default)
SELECT 
  c.id,
  category.name,
  category.color,
  true
FROM public.companies c
CROSS JOIN (VALUES 
  ('Food', 'green'),
  ('Beer', 'amber'),
  ('Wine', 'purple'),
  ('Spirits', 'blue'),
  ('Snacks', 'orange')
) AS category(name, color)
ON CONFLICT (company_id, name) DO NOTHING;

-- Enable realtime
ALTER TABLE public.supplier_categories REPLICA IDENTITY FULL;