-- Update the prevent_optimizer_critical_changes trigger to allow user-initiated changes
-- when last_manual_move_time is being updated (proves user intent)

CREATE OR REPLACE FUNCTION public.prevent_optimizer_critical_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only check updates, not inserts
  IF TG_OP = 'UPDATE' THEN
    -- If auth.uid() is NULL, this is service role (optimizer/system)
    -- BUT: If last_manual_move_time is being updated, it's a user-initiated change (manual move from UI)
    -- Block changes ONLY if it's service role AND last_manual_move_time is NOT being set
    IF auth.uid() IS NULL AND (OLD.last_manual_move_time IS NOT DISTINCT FROM NEW.last_manual_move_time) THEN
      -- Check if critical fields changed
      IF (OLD.time IS DISTINCT FROM NEW.time) THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Optimizer cannot modify reservation time. Old: %, New: %', OLD.time, NEW.time
          USING ERRCODE = 'check_violation',
                HINT = 'Only authenticated users can change reservation times';
      END IF;
      
      IF (OLD.date IS DISTINCT FROM NEW.date) THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Optimizer cannot modify reservation date. Old: %, New: %', OLD.date, NEW.date
          USING ERRCODE = 'check_violation',
                HINT = 'Only authenticated users can change reservation dates';
      END IF;
      
      IF (OLD.party_size IS DISTINCT FROM NEW.party_size) THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Optimizer cannot modify party size. Old: %, New: %', OLD.party_size, NEW.party_size
          USING ERRCODE = 'check_violation',
                HINT = 'Only authenticated users can change party sizes';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;