-- Add allergen fields to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS has_allergens boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS allergens text[] DEFAULT '{}';

-- Update any existing reservations to have default values
UPDATE public.reservations 
SET has_allergens = false, allergens = '{}' 
WHERE has_allergens IS NULL OR allergens IS NULL;