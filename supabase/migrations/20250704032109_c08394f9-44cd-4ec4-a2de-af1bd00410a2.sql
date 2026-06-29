
-- First, let's check and remove any problematic constraints
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_shape_check;

-- Now let's properly update the tables according to your image layout:
-- Tables 1-10: Round, 4 seats (these are correct)
UPDATE public.tables SET seats = 4, shape = 'round' WHERE table_number >= 1 AND table_number <= 10;

-- Tables 11-19: Rectangle, 6 seats  
UPDATE public.tables SET seats = 6, shape = 'rectangle' WHERE table_number >= 11 AND table_number <= 19;

-- Tables 20-24: Rectangle, 8 seats
UPDATE public.tables SET seats = 8, shape = 'rectangle' WHERE table_number >= 20 AND table_number <= 24;

-- Clean up table 25 if it exists and rename to 23
UPDATE public.tables SET table_number = 23, table_name = 'T23', seats = 8, shape = 'rectangle' 
WHERE table_number = 25 AND NOT EXISTS (SELECT 1 FROM public.tables WHERE table_number = 23);

-- Remove any tables that shouldn't exist
DELETE FROM public.tables WHERE table_number > 24 AND table_number != 23;

-- Ensure consistent naming
UPDATE public.tables SET table_name = 'T' || table_number::text;

-- Let's verify the results
SELECT table_number, table_name, seats, shape FROM public.tables ORDER BY table_number;
