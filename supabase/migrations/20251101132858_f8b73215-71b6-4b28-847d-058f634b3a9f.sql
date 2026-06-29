-- Add allergens column to ingredients table
ALTER TABLE public.ingredients
ADD COLUMN IF NOT EXISTS allergens text[] DEFAULT '{}' NOT NULL;

-- Add GIN index for array search performance
CREATE INDEX idx_ingredients_allergens ON public.ingredients USING GIN (allergens);

-- Add comment
COMMENT ON COLUMN public.ingredients.allergens IS 'Array of allergen names from the EU standard 14 allergen list';