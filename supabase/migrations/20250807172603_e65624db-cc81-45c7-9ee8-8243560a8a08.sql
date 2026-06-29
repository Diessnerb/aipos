-- Create function to generate unique PIN codes
CREATE OR REPLACE FUNCTION public.generate_unique_pin()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  new_pin text;
  pin_exists boolean;
BEGIN
  LOOP
    -- Generate a random 4-digit PIN
    new_pin := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    
    -- Check if PIN already exists
    SELECT EXISTS(SELECT 1 FROM public.users WHERE pin_code = new_pin) INTO pin_exists;
    
    -- If PIN doesn't exist, return it
    IF NOT pin_exists THEN
      RETURN new_pin;
    END IF;
  END LOOP;
END;
$function$;