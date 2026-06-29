-- Add additional address fields to locations table
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS county text,
ADD COLUMN IF NOT EXISTS country text DEFAULT 'United Kingdom',
ADD COLUMN IF NOT EXISTS district text,
ADD COLUMN IF NOT EXISTS ward text;