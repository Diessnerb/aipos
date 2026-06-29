-- Add unique constraint on company_settings.company_id to prevent duplicates
ALTER TABLE public.company_settings DROP CONSTRAINT IF EXISTS company_settings_company_id_unique;
ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_company_id_unique UNIQUE (company_id);

-- Backfill missing company_settings records for active companies
INSERT INTO public.company_settings (
  company_id, 
  company_name, 
  auto_assign_tables, 
  optimization_enabled, 
  optimization_mode,
  created_at,
  updated_at
)
SELECT 
  c.id,
  c.name,
  false,
  false,
  'disabled',
  now(),
  now()
FROM public.companies c
LEFT JOIN public.company_settings cs ON c.id = cs.company_id
WHERE c.status = 'active' 
  AND cs.company_id IS NULL
ON CONFLICT (company_id) DO NOTHING;