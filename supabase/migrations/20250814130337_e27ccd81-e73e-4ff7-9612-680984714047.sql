-- Add company_id column to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS company_id uuid;

-- Create foreign key constraint to companies table
ALTER TABLE public.company_settings 
ADD CONSTRAINT fk_company_settings_company_id 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- Update existing records to link them to their companies
-- Since the table uses 'id' as the primary key and this should match company IDs,
-- we'll set company_id = id for existing records
UPDATE public.company_settings 
SET company_id = id 
WHERE company_id IS NULL;

-- Add unique constraint to ensure one settings record per company
ALTER TABLE public.company_settings 
ADD CONSTRAINT unique_company_settings_per_company 
UNIQUE (company_id);

-- Update the trigger function to set company_id properly
CREATE OR REPLACE FUNCTION public.set_company_settings_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  -- Keep the existing behavior for the id field
  IF NEW.id IS NULL THEN
    NEW.id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for the company_id field
DROP TRIGGER IF EXISTS set_company_settings_company_id_trigger ON public.company_settings;
CREATE TRIGGER set_company_settings_company_id_trigger
  BEFORE INSERT ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_settings_company_id();

-- Update RLS policies to use company_id for better security
DROP POLICY IF EXISTS "Company users can view their company settings" ON public.company_settings;
CREATE POLICY "Company users can view their company settings" 
ON public.company_settings 
FOR SELECT 
USING (company_id = get_user_company_safe());

DROP POLICY IF EXISTS "Company admins can update their company settings" ON public.company_settings;
CREATE POLICY "Company admins can update their company settings" 
ON public.company_settings 
FOR UPDATE 
USING (company_id = get_user_company_safe() AND EXISTS (
  SELECT 1 FROM users 
  WHERE auth_user_id = auth.uid() 
  AND role IN ('admin', 'manager')
));

DROP POLICY IF EXISTS "Company admins/managers can insert their company settings" ON public.company_settings;
CREATE POLICY "Company admins/managers can insert their company settings" 
ON public.company_settings 
FOR INSERT 
WITH CHECK (company_id = get_user_company_safe() AND EXISTS (
  SELECT 1 FROM users 
  WHERE auth_user_id = auth.uid() 
  AND role IN ('admin', 'manager')
));