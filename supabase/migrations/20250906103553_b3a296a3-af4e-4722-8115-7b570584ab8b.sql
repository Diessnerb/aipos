-- Fix the ON CONFLICT constraint issue by using explicit constraint name
CREATE OR REPLACE FUNCTION public.update_daily_growth_metrics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  metric_date_var DATE := NEW.date;
  company_uuid UUID := NEW.company_id;
BEGIN
  -- Update daily metrics using explicit constraint name
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
  )
  ON CONFLICT ON CONSTRAINT company_growth_metrics_company_id_metric_date_key
  DO UPDATE SET 
    total_reservations = public.company_growth_metrics.total_reservations + 1,
    total_covers = public.company_growth_metrics.total_covers + NEW.party_size,
    updated_at = now();
    
  RETURN NEW;
END;
$function$;