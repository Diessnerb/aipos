-- Fix the ON CONFLICT issue by using a different approach - check and insert/update pattern
CREATE OR REPLACE FUNCTION public.update_daily_growth_metrics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  metric_date_var DATE := NEW.date;
  company_uuid UUID := NEW.company_id;
  existing_record_id UUID;
BEGIN
  -- Check if record exists
  SELECT id INTO existing_record_id
  FROM public.company_growth_metrics 
  WHERE company_id = company_uuid AND metric_date = metric_date_var;
  
  IF existing_record_id IS NOT NULL THEN
    -- Update existing record
    UPDATE public.company_growth_metrics 
    SET 
      total_reservations = total_reservations + 1,
      total_covers = total_covers + NEW.party_size,
      updated_at = now()
    WHERE id = existing_record_id;
  ELSE
    -- Insert new record
    INSERT INTO public.company_growth_metrics (
      company_id,
      metric_date,
      total_reservations,
      total_covers
    ) VALUES (
      company_uuid,
      metric_date_var,
      1,
      NEW.party_size
    );
  END IF;
    
  RETURN NEW;
END;
$function$;