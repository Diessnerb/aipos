
-- Update tables based on the provided image information
-- First, let's update all existing tables with their correct information

-- Update Table 1: Round, 4 seats
UPDATE public.tables SET table_name = 'T1', seats = 4, shape = 'round' WHERE table_number = 1;

-- Update Table 2: Round, 4 seats  
UPDATE public.tables SET table_name = 'T2', seats = 4, shape = 'round' WHERE table_number = 2;

-- Update Table 3: Round, 4 seats
UPDATE public.tables SET table_name = 'T3', seats = 4, shape = 'round' WHERE table_number = 3;

-- Update Table 4: Round, 4 seats
UPDATE public.tables SET table_name = 'T4', seats = 4, shape = 'round' WHERE table_number = 4;

-- Update Table 5: Round, 4 seats
UPDATE public.tables SET table_name = 'T5', seats = 4, shape = 'round' WHERE table_number = 5;

-- Update Table 6: Round, 4 seats
UPDATE public.tables SET table_name = 'T6', seats = 4, shape = 'round' WHERE table_number = 6;

-- Update Table 7: Round, 4 seats
UPDATE public.tables SET table_name = 'T7', seats = 4, shape = 'round' WHERE table_number = 7;

-- Update Table 8: Round, 4 seats
UPDATE public.tables SET table_name = 'T8', seats = 4, shape = 'round' WHERE table_number = 8;

-- Update Table 9: Round, 4 seats
UPDATE public.tables SET table_name = 'T9', seats = 4, shape = 'round' WHERE table_number = 9;

-- Update Table 10: Round, 4 seats
UPDATE public.tables SET table_name = 'T10', seats = 4, shape = 'round' WHERE table_number = 10;

-- Update Table 11: Rectangle, 6 seats
UPDATE public.tables SET table_name = 'T11', seats = 6, shape = 'rectangle' WHERE table_number = 11;

-- Update Table 12: Rectangle, 6 seats
UPDATE public.tables SET table_name = 'T12', seats = 6, shape = 'rectangle' WHERE table_number = 12;

-- Table 13 will be deleted (it doesn't exist in the new layout)

-- Update Table 14: Rectangle, 6 seats
UPDATE public.tables SET table_name = 'T14', seats = 6, shape = 'rectangle' WHERE table_number = 14;

-- Update Table 15: Rectangle, 6 seats
UPDATE public.tables SET table_name = 'T15', seats = 6, shape = 'rectangle' WHERE table_number = 15;

-- Update Table 16: Rectangle, 6 seats
UPDATE public.tables SET table_name = 'T16', seats = 6, shape = 'rectangle' WHERE table_number = 16;

-- Update Table 17: Rectangle, 6 seats
UPDATE public.tables SET table_name = 'T17', seats = 6, shape = 'rectangle' WHERE table_number = 17;

-- Update Table 18: Rectangle, 6 seats
UPDATE public.tables SET table_name = 'T18', seats = 6, shape = 'rectangle' WHERE table_number = 18;

-- Update Table 19: Rectangle, 6 seats
UPDATE public.tables SET table_name = 'T19', seats = 6, shape = 'rectangle' WHERE table_number = 19;

-- Update Table 20: Rectangle, 8 seats
UPDATE public.tables SET table_name = 'T20', seats = 8, shape = 'rectangle' WHERE table_number = 20;

-- Update Table 21: Rectangle, 8 seats
UPDATE public.tables SET table_name = 'T21', seats = 8, shape = 'rectangle' WHERE table_number = 21;

-- Update Table 22: Rectangle, 8 seats
UPDATE public.tables SET table_name = 'T22', seats = 8, shape = 'rectangle' WHERE table_number = 22;

-- Update Table 24: Rectangle, 8 seats
UPDATE public.tables SET table_name = 'T24', seats = 8, shape = 'rectangle' WHERE table_number = 24;

-- Rename Table 25 to Table 23: Rectangle, 8 seats
UPDATE public.tables SET table_number = 23, table_name = 'T23', seats = 8, shape = 'rectangle' WHERE table_number = 25;

-- Update any reservations that reference table 25 to now reference table 23
UPDATE public.reservations SET table_number = 23 WHERE table_number = 25;

-- Update any reservations with table_numbers array that contains 25 to contain 23 instead
UPDATE public.reservations 
SET table_numbers = array_replace(table_numbers, 25, 23) 
WHERE table_numbers @> ARRAY[25];

-- Finally, delete Table 13 as it doesn't exist in the new layout
-- First, update any reservations that reference table 13 to be unassigned (null)
UPDATE public.reservations SET table_number = NULL WHERE table_number = 13;

-- Remove table 13 from any multi-table reservations
UPDATE public.reservations 
SET table_numbers = array_remove(table_numbers, 13) 
WHERE table_numbers @> ARRAY[13];

-- Now delete the table
DELETE FROM public.tables WHERE table_number = 13;
