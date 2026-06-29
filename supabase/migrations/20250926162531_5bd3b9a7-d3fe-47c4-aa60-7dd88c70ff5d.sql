-- Enable realtime for reservations table
ALTER TABLE public.reservations REPLICA IDENTITY FULL;

-- Add reservations table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;

-- Create function to normalize table number fields
CREATE OR REPLACE FUNCTION public.reservations_normalize_tables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If table_numbers has exactly one element, set table_number to match
  IF NEW.table_numbers IS NOT NULL AND array_length(NEW.table_numbers, 1) = 1 THEN
    NEW.table_number := NEW.table_numbers[1];
  END IF;
  
  -- If table_number is set but table_numbers is empty/null, set table_numbers
  IF NEW.table_number IS NOT NULL AND (NEW.table_numbers IS NULL OR array_length(NEW.table_numbers, 1) = 0) THEN
    NEW.table_numbers := ARRAY[NEW.table_number];
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to normalize table fields on insert/update
CREATE TRIGGER reservations_normalize_tables_trigger
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.reservations_normalize_tables();