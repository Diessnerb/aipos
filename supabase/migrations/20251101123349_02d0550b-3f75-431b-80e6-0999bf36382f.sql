-- Create ingredients table for master ingredient library
CREATE TABLE IF NOT EXISTS public.ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Pricing
  sale_price NUMERIC(10, 2) NOT NULL,
  cost_price NUMERIC(10, 2),
  
  -- Portion/Serving Info
  portion_size NUMERIC(10, 3) NOT NULL,
  portion_type TEXT NOT NULL DEFAULT 'g',
  
  -- Purchase Info (Optional - for inventory management)
  supplier TEXT,
  purchase_size NUMERIC(10, 3),
  purchase_type TEXT,
  purchase_price NUMERIC(10, 2),
  
  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

-- RLS Policy for company isolation
CREATE POLICY "ingredients_company_isolation"
ON public.ingredients
FOR ALL
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Create indexes
CREATE INDEX idx_ingredients_company ON public.ingredients(company_id);
CREATE INDEX idx_ingredients_name ON public.ingredients(company_id, name);
CREATE INDEX idx_ingredients_active ON public.ingredients(company_id, is_active);

-- Add trigger for updated_at
CREATE TRIGGER update_ingredients_updated_at
BEFORE UPDATE ON public.ingredients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add unique constraint for name within company
CREATE UNIQUE INDEX idx_ingredients_unique_name_per_company 
ON public.ingredients(company_id, LOWER(name)) 
WHERE is_active = true;