-- Fix the functions to use the correct column names based on actual table structure

-- Fix update_reservation_patterns function to use correct column names
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
    -- Update existing pattern using correct column name
    UPDATE public.reservation_patterns 
    SET 
      frequency_count = frequency_count + 1,
      updated_at = now()
    WHERE id = existing_pattern_id;
  ELSE
    -- Insert new pattern using correct column name
    INSERT INTO public.reservation_patterns (
      company_id,
      day_of_week,
      hour_of_day,
      party_size,
      week_of_year,
      year,
      frequency_count
    ) VALUES (
      company_uuid,
      day_of_week_var,
      hour_of_day_var,
      NEW.party_size,
      week_of_year_var,
      year_var,
      1
    );
  END IF;
    
  RETURN NEW;
END;
$function$;

-- Fix update_seasonal_adjustments function to match actual table structure
CREATE OR REPLACE FUNCTION public.update_seasonal_adjustments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  company_uuid UUID := NEW.company_id;
  week_of_year_var INTEGER := EXTRACT(WEEK FROM NEW.date);
  existing_adjustment_id UUID;
BEGIN
  -- Check if seasonal adjustment record exists for this week
  SELECT id INTO existing_adjustment_id
  FROM public.seasonal_adjustments 
  WHERE company_id = company_uuid 
    AND season_type = 'weekly'
    AND week_of_year_var = ANY(week_range);
  
  IF existing_adjustment_id IS NOT NULL THEN
    -- Update existing adjustment
    UPDATE public.seasonal_adjustments 
    SET 
      party_size_multiplier = COALESCE(party_size_multiplier, 1.0) * 1.01,
      volume_multiplier = COALESCE(volume_multiplier, 1.0) * 1.01,
      updated_at = now()
    WHERE id = existing_adjustment_id;
  ELSE
    -- Insert new seasonal adjustment with default values
    INSERT INTO public.seasonal_adjustments (
      company_id,
      season_type,
      week_range,
      party_size_multiplier,
      volume_multiplier,
      large_party_probability,
      is_active
    ) VALUES (
      company_uuid,
      'weekly',
      ARRAY[week_of_year_var],
      1.0,
      1.0,
      0.1,
      true
    );
  END IF;
    
  RETURN NEW;
END;
$function$;