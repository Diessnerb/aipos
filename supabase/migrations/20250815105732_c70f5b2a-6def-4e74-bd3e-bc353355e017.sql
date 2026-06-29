-- Update the existing company name to proper capitalization
UPDATE companies 
SET name = 'Bertrams' 
WHERE name = 'bertrams';

-- Create company_settings record for Bertrams company
INSERT INTO company_settings (
  company_id, 
  company_name, 
  logo_url, 
  auto_assign_tables,
  show_allergen_disclaimer
)
SELECT 
  id,
  'Bertrams',
  NULL,
  false,
  false
FROM companies 
WHERE name = 'Bertrams' 
AND NOT EXISTS (
  SELECT 1 FROM company_settings 
  WHERE company_id = companies.id
);