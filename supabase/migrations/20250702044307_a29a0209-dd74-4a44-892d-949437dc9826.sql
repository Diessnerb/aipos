
-- Add table_numbers column to store array of table numbers for multi-table reservations
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS table_numbers integer[];

-- Update existing multi-table reservations to populate the new column
-- This will extract table numbers from notes field where they exist
UPDATE public.reservations 
SET table_numbers = ARRAY(
  SELECT unnest(
    string_to_array(
      substring(notes FROM 'Tables: ([0-9, ]+)'), 
      ', '
    )::int[]
  )
)
WHERE notes LIKE '%Tables: %';

-- For reservations that have a single table_number, also populate table_numbers array
UPDATE public.reservations 
SET table_numbers = ARRAY[table_number]
WHERE table_number IS NOT NULL 
AND (table_numbers IS NULL OR array_length(table_numbers, 1) IS NULL);
