
-- Add locked column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false;
