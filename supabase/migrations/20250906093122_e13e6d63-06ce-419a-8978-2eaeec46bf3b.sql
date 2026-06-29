-- Fix security warnings by setting proper search_path for functions

-- Drop and recreate functions with proper security settings
DROP FUNCTION IF EXISTS public.update_reservation_patterns() CASCADE;
DROP FUNCTION IF EXISTS public.update_daily_growth_metrics() CASCADE;

-- Create function to update reservation patterns automatically with proper security
CREATE OR REPLACE FUNCTION public.update_reservation_patterns()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only process confirmed reservations
  IF NEW.status = 'confirmed' THEN
    INSERT INTO public.reservation_patterns (
      company_id,
      day_of_week,
      hour_of_day,
      party_size,
      week_of_year,
      year,
      frequency_count
    ) VALUES (
      NEW.company_id,
      EXTRACT(DOW FROM NEW.date),
      EXTRACT(HOUR FROM NEW.time),
      NEW.party_size,
      EXTRACT(WEEK FROM NEW.date),
      EXTRACT(YEAR FROM NEW.date),
      1
    )
    ON CONFLICT (company_id, day_of_week, hour_of_day, party_size, week_of_year, year)
    DO UPDATE SET 
      frequency_count = reservation_patterns.frequency_count + 1,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create function to update daily growth metrics with proper security
CREATE OR REPLACE FUNCTION public.update_daily_growth_metrics()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  metric_date DATE := NEW.date;
  company_uuid UUID := NEW.company_id;
BEGIN
  -- Update daily metrics
  INSERT INTO public.company_growth_metrics (
    company_id,
    metric_date,
    total_reservations,
    total_covers
  ) VALUES (
    company_uuid,
    metric_date,
    1,
    NEW.party_size
  )
  ON CONFLICT (company_id, metric_date)
  DO UPDATE SET 
    total_reservations = company_growth_metrics.total_reservations + 1,
    total_covers = company_growth_metrics.total_covers + NEW.party_size,
    updated_at = now();
    
  RETURN NEW;
END;
$$;