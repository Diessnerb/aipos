-- Add location address fields to the locations table
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS address_line text,
ADD COLUMN IF NOT EXISTS postcode text,
ADD COLUMN IF NOT EXISTS full_address text,
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;

-- Update existing locations to have a full address based on existing address field
UPDATE public.locations 
SET full_address = address 
WHERE address IS NOT NULL AND full_address IS NULL;