-- Clean up duplicate customers by phone number, keeping the one with most visits and most recent last_visit
WITH duplicates AS (
  SELECT 
    company_id, 
    phone,
    array_agg(id ORDER BY COALESCE(visits, 0) DESC, COALESCE(last_visit, '1900-01-01') DESC) as customer_ids
  FROM customers 
  WHERE phone IS NOT NULL AND phone <> ''
  GROUP BY company_id, phone 
  HAVING COUNT(*) > 1
),
ids_to_delete AS (
  SELECT unnest(customer_ids[2:]) as id_to_delete
  FROM duplicates
)
DELETE FROM customers
WHERE id IN (SELECT id_to_delete FROM ids_to_delete);

-- Now create the unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uniq_customers_company_phone_not_empty 
ON public.customers (company_id, phone) 
WHERE phone IS NOT NULL AND phone <> '';

-- Add comment explaining the constraint
COMMENT ON INDEX uniq_customers_company_phone_not_empty IS 'Ensures unique phone numbers per company (excluding null/empty values)';
