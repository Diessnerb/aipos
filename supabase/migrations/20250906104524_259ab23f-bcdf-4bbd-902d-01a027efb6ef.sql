-- Comprehensive fix for all reservation-related database issues

-- Step 1: Add missing unique constraint to reservation_patterns table
ALTER TABLE public.reservation_patterns 
ADD CONSTRAINT reservation_patterns_unique_pattern 
UNIQUE (company_id, day_of_week, hour_of_day, party_size, week_of_year, year);

-- Step 2: Fix the update_reservation_patterns function to use check-and-update pattern
CREATE OR REPLACE FUNCTION public.update_reservation_patterns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pattern_date_var DATE := NEW.date;
  company_uuid UUID := NEW.company_id;
  day_of_week_var INTEGER := EXTRACT(DOW FROM pattern_date_var);
  hour_of_day_var INTEGER := EXTRACT(HOUR FROM NEW.time);
  week_of_year_var INTEGER := EXTRACT(WEEK FROM pattern_date_var);
  year_var INTEGER := EXTRACT(YEAR FROM pattern_date_var);
  existing_pattern_id UUID;
BEGIN
  -- Check if pattern record exists
  SELECT id INTO existing_pattern_id
  FROM public.reservation_patterns 
  WHERE company_id = company_uuid 
    AND day_of_week = day_of_week_var
    AND hour_of_day = hour_of_day_var
    AND party_size = NEW.party_size
    AND week_of_year = week_of_year_var
    AND year = year_var;
  
  IF existing_pattern_id IS NOT NULL THEN
    -- Update existing pattern
    UPDATE public.reservation_patterns 
    SET 
      booking_count = booking_count + 1,
      total_party_size = total_party_size + NEW.party_size,
      updated_at = now()
    WHERE id = existing_pattern_id;
  ELSE
    -- Insert new pattern
    INSERT INTO public.reservation_patterns (
      company_id,
      day_of_week,
      hour_of_day,
      party_size,
      week_of_year,
      year,
      booking_count,
      total_party_size
    ) VALUES (
      company_uuid,
      day_of_week_var,
      hour_of_day_var,
      NEW.party_size,
      week_of_year_var,
      year_var,
      1,
      NEW.party_size
    );
  END IF;
    
  RETURN NEW;
END;
$function$;

-- Step 3: Create the missing update_seasonal_adjustments function
CREATE OR REPLACE FUNCTION public.update_seasonal_adjustments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  company_uuid UUID := NEW.company_id;
  month_var INTEGER := EXTRACT(MONTH FROM NEW.date);
  day_of_week_var INTEGER := EXTRACT(DOW FROM NEW.date);
  existing_adjustment_id UUID;
BEGIN
  -- Check if seasonal adjustment record exists
  SELECT id INTO existing_adjustment_id
  FROM public.seasonal_adjustments 
  WHERE company_id = company_uuid 
    AND month = month_var
    AND day_of_week = day_of_week_var;
  
  IF existing_adjustment_id IS NOT NULL THEN
    -- Update existing adjustment
    UPDATE public.seasonal_adjustments 
    SET 
      demand_multiplier = CASE 
        WHEN booking_count = 0 THEN 1.0
        ELSE LEAST(2.0, GREATEST(0.5, (booking_count + 1.0) / GREATEST(1, historical_average)))
      END,
      booking_count = booking_count + 1,
      updated_at = now()
    WHERE id = existing_adjustment_id;
  ELSE
    -- Insert new adjustment with default values
    INSERT INTO public.seasonal_adjustments (
      company_id,
      month,
      day_of_week,
      demand_multiplier,
      booking_probability,
      booking_count,
      historical_average
    ) VALUES (
      company_uuid,
      month_var,
      day_of_week_var,
      1.0,
      0.5,
      1,
      1
    );
  END IF;
    
  RETURN NEW;
END;
$function$;

-- Step 4: Remove duplicate triggers and recreate them properly
DROP TRIGGER IF EXISTS update_growth_metrics_trigger ON public.reservations;
DROP TRIGGER IF EXISTS update_reservation_patterns_trigger ON public.reservations;
DROP TRIGGER IF EXISTS update_seasonal_adjustments_trigger ON public.reservations;

-- Recreate triggers in the correct order
CREATE TRIGGER update_growth_metrics_trigger
    AFTER INSERT ON public.reservations
    FOR EACH ROW EXECUTE FUNCTION public.update_daily_growth_metrics();

CREATE TRIGGER update_reservation_patterns_trigger
    AFTER INSERT ON public.reservations
    FOR EACH ROW EXECUTE FUNCTION public.update_reservation_patterns();

CREATE TRIGGER update_seasonal_adjustments_trigger
    AFTER INSERT ON public.reservations
    FOR EACH ROW EXECUTE FUNCTION public.update_seasonal_adjustments();

-- Step 5: Ensure proper RLS policies for analytics tables
-- Enable RLS on analytics tables if not already enabled
ALTER TABLE public.reservation_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_adjustments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reservation_patterns
DROP POLICY IF EXISTS "reservation_patterns_company_isolation" ON public.reservation_patterns;
CREATE POLICY "reservation_patterns_company_isolation" ON public.reservation_patterns
    FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Create RLS policies for seasonal_adjustments  
DROP POLICY IF EXISTS "seasonal_adjustments_company_isolation" ON public.seasonal_adjustments;
CREATE POLICY "seasonal_adjustments_company_isolation" ON public.seasonal_adjustments
    FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()));