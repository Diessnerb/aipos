-- Enable Row Level Security on deals table
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for deals
DROP POLICY IF EXISTS "deals_company_isolation" ON public.deals;
CREATE POLICY "deals_company_isolation" ON public.deals 
FOR ALL 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Create trigger to set company_id
CREATE OR REPLACE FUNCTION public.set_deals_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS deals_set_company_id ON public.deals;
CREATE TRIGGER deals_set_company_id BEFORE INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_deals_company_id();

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS deals_updated_at ON public.deals;
CREATE TRIGGER deals_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamp();