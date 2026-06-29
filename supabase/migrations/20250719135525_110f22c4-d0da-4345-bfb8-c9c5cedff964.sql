
-- Update the trigger function to only set defaults on INSERT, not UPDATE
CREATE OR REPLACE FUNCTION public.set_reservation_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  -- Only set defaults for new reservations (INSERT), not updates
  if TG_OP = 'INSERT' then
    new.start_time := new.time;
    new.end_time := new.time + interval '90 minutes';
    new.status := 'confirmed';
  end if;
  return new;
end;
$function$;

-- Drop the existing trigger
DROP TRIGGER IF EXISTS set_reservation_defaults_trigger ON public.reservations;

-- Recreate the trigger to only fire on INSERT operations
CREATE TRIGGER set_reservation_defaults_trigger
  BEFORE INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_reservation_defaults();
