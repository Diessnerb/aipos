-- Fix missing user association: Associate user with PIN "2222" with "Loom Bar & Cafe" company
UPDATE public.users 
SET company_id = (
  SELECT id 
  FROM public.companies 
  WHERE name = 'Loom Bar & Cafe' 
  LIMIT 1
)
WHERE pin_code = '2222' AND company_id IS NULL;