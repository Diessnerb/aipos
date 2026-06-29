-- Create enhanced analytics tables for intelligent table assignment system

-- Track historical reservation patterns for predictive analytics
CREATE TABLE IF NOT EXISTS public.reservation_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 6=Saturday
  hour_of_day INTEGER NOT NULL, -- 0-23
  party_size INTEGER NOT NULL,
  week_of_year INTEGER NOT NULL, -- 1-52
  year INTEGER NOT NULL,
  frequency_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Track how well table assignments performed for learning
CREATE TABLE IF NOT EXISTS public.table_utilization_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  reservation_id UUID NOT NULL,
  assigned_table_numbers INTEGER[] NOT NULL,
  party_size INTEGER NOT NULL,
  assignment_strategy TEXT,
  was_moved_manually BOOLEAN DEFAULT false,
  move_reason TEXT,
  opportunity_cost_score NUMERIC(5,2), -- How much capacity was "wasted"
  utilization_efficiency NUMERIC(5,2), -- 0-100% how well table was used
  assignment_date DATE NOT NULL,
  assignment_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Log manual table moves with staff feedback for learning
CREATE TABLE IF NOT EXISTS public.manual_override_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  reservation_id UUID NOT NULL,
  old_table_numbers INTEGER[],
  new_table_numbers INTEGER[] NOT NULL,
  staff_user_id UUID,
  feedback_reasons TEXT[], -- ["customer_preference", "table_broken", "better_view", "accessibility", "vip_request", "group_dynamic"]
  additional_notes TEXT,
  move_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Track company growth metrics for demand prediction
CREATE TABLE IF NOT EXISTS public.company_growth_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  metric_date DATE NOT NULL,
  total_reservations INTEGER NOT NULL DEFAULT 0,
  total_covers INTEGER NOT NULL DEFAULT 0, -- Total people served
  peak_hour_reservations INTEGER NOT NULL DEFAULT 0,
  average_party_size NUMERIC(4,2),
  table_turnover_rate NUMERIC(5,2), -- How many times tables turned over
  no_show_rate NUMERIC(5,2), -- Percentage of no-shows
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, metric_date)
);

-- Track seasonal adjustments and weights for historical data
CREATE TABLE IF NOT EXISTS public.seasonal_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  season_type TEXT NOT NULL, -- "christmas", "easter", "summer", "winter", "valentine", etc.
  week_range INTEGER[] NOT NULL, -- Array of week numbers affected
  party_size_multiplier NUMERIC(4,2) DEFAULT 1.0, -- Adjustment for average party sizes
  volume_multiplier NUMERIC(4,2) DEFAULT 1.0, -- Adjustment for booking volume
  large_party_probability NUMERIC(5,2) DEFAULT 0.0, -- Increased probability of 6+ parties
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.reservation_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_utilization_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_override_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_growth_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_adjustments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company isolation
CREATE POLICY "reservation_patterns_company_isolation" ON public.reservation_patterns
FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "table_utilization_analytics_company_isolation" ON public.table_utilization_analytics
FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "manual_override_feedback_company_isolation" ON public.manual_override_feedback
FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "company_growth_metrics_company_isolation" ON public.company_growth_metrics
FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "seasonal_adjustments_company_isolation" ON public.seasonal_adjustments
FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Create indexes for performance
CREATE INDEX idx_reservation_patterns_company_lookup ON public.reservation_patterns(company_id, day_of_week, hour_of_day);
CREATE INDEX idx_reservation_patterns_seasonal ON public.reservation_patterns(company_id, week_of_year, year);

CREATE INDEX idx_table_utilization_company_date ON public.table_utilization_analytics(company_id, assignment_date);
CREATE INDEX idx_table_utilization_strategy ON public.table_utilization_analytics(company_id, assignment_strategy);

CREATE INDEX idx_manual_override_company_time ON public.manual_override_feedback(company_id, move_timestamp);

CREATE INDEX idx_growth_metrics_company_date ON public.company_growth_metrics(company_id, metric_date);

CREATE INDEX idx_seasonal_adjustments_company_active ON public.seasonal_adjustments(company_id, is_active);

-- Insert default seasonal adjustments
INSERT INTO public.seasonal_adjustments (company_id, season_type, week_range, party_size_multiplier, volume_multiplier, large_party_probability) VALUES
-- Christmas period (weeks 50-52, 1-2)
(gen_random_uuid(), 'christmas', ARRAY[50,51,52,1,2], 1.4, 1.6, 0.35),
-- Easter period (varies, but typically weeks 13-16)
(gen_random_uuid(), 'easter', ARRAY[13,14,15,16], 1.2, 1.3, 0.25),
-- Summer holidays (weeks 26-35)
(gen_random_uuid(), 'summer', ARRAY[26,27,28,29,30,31,32,33,34,35], 1.1, 1.2, 0.20),
-- Valentine's Day (week 6-7)
(gen_random_uuid(), 'valentine', ARRAY[6,7], 0.9, 1.1, 0.10);

-- Create function to update reservation patterns automatically
CREATE OR REPLACE FUNCTION public.update_reservation_patterns()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update patterns
CREATE TRIGGER update_reservation_patterns_trigger
  AFTER INSERT OR UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reservation_patterns();

-- Create function to update daily growth metrics
CREATE OR REPLACE FUNCTION public.update_daily_growth_metrics()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for growth metrics
CREATE TRIGGER update_growth_metrics_trigger
  AFTER INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_daily_growth_metrics();