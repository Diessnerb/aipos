-- Temporarily disable the company isolation trigger
ALTER TABLE public.tables DISABLE TRIGGER trigger_company_isolation_tables;

-- Delete the soft-deleted tables (32, 33, 35, 36)
DELETE FROM public.tables
WHERE is_active = false
  AND table_number IN (32, 33, 35, 36);

-- Re-enable the company isolation trigger
ALTER TABLE public.tables ENABLE TRIGGER trigger_company_isolation_tables;