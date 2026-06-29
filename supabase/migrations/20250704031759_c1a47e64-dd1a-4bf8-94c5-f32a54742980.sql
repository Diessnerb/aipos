
-- First, let's check the current state of tables to see what went wrong
SELECT table_number, table_name, seats, shape FROM public.tables ORDER BY table_number;

-- Now let's properly update the tables according to the image layout:

-- Tables 1-10: Round, 4 seats
UPDATE public.tables SET seats = 4, shape = 'round' WHERE table_number >= 1 AND table_number <= 10;

-- Tables 11-19: Rectangle, 6 seats  
UPDATE public.tables SET seats = 6, shape = 'rectangle' WHERE table_number >= 11 AND table_number <= 19;

-- Tables 20-24: Rectangle, 8 seats
UPDATE public.tables SET seats = 8, shape = 'rectangle' WHERE table_number >= 20 AND table_number <= 24;

-- Handle the special case where table 25 was renamed to 23 (if it exists)
UPDATE public.tables SET table_number = 23, table_name = 'T23', seats = 8, shape = 'rectangle' WHERE table_number = 25 AND NOT EXISTS (SELECT 1 FROM public.tables WHERE table_number = 23);

-- Clean up any duplicate or incorrect entries
DELETE FROM public.tables WHERE table_number = 13;
DELETE FROM public.tables WHERE table_number > 26;

-- Ensure table names are consistent
UPDATE public.tables SET table_name = 'T' || table_number::text WHERE table_name IS NULL OR table_name = '' OR table_name = 'Table ' || table_number::text;
