-- Add external_id column to reservations table for external system integration
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS external_id text;

-- Add unique partial index for efficient lookups and prevent duplicates from same external system
CREATE UNIQUE INDEX idx_reservations_company_external_id 
ON public.reservations (company_id, external_id) 
WHERE external_id IS NOT NULL;