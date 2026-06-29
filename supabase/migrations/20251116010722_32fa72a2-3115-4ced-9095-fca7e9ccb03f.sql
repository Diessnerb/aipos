-- Add supplier_id foreign key to ingredients table
ALTER TABLE public.ingredients 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);

-- Add index for performance
CREATE INDEX idx_ingredients_supplier_id ON public.ingredients(supplier_id);

-- Add comment
COMMENT ON COLUMN public.ingredients.supplier_id IS 'Foreign key reference to the suppliers table';