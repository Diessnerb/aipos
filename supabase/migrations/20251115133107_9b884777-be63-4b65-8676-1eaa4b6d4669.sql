-- Create wastage_log table
CREATE TABLE IF NOT EXISTS public.wastage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'Individual',
  reason TEXT NOT NULL CHECK (reason IN ('expired', 'damaged', 'overproduction', 'other')),
  cost_impact NUMERIC NOT NULL DEFAULT 0,
  location TEXT NOT NULL CHECK (location IN ('kitchen', 'bar')),
  notes TEXT,
  logged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  wastage_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_wastage_log_company_id ON public.wastage_log(company_id);
CREATE INDEX idx_wastage_log_ingredient_id ON public.wastage_log(ingredient_id);
CREATE INDEX idx_wastage_log_wastage_time ON public.wastage_log(wastage_time DESC);
CREATE INDEX idx_wastage_log_location ON public.wastage_log(location);

-- Enable Row Level Security
ALTER TABLE public.wastage_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for company isolation
CREATE POLICY wastage_log_company_isolation ON public.wastage_log
  FOR ALL
  USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Enable realtime
ALTER TABLE public.wastage_log REPLICA IDENTITY FULL;

-- Create ingredient_usage_analytics table
CREATE TABLE IF NOT EXISTS public.ingredient_usage_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  quantity_used NUMERIC NOT NULL DEFAULT 0,
  quantity_wasted NUMERIC NOT NULL DEFAULT 0,
  quantity_purchased NUMERIC NOT NULL DEFAULT 0,
  average_daily_usage NUMERIC,
  projected_days_remaining INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, ingredient_id, date)
);

-- Create indexes
CREATE INDEX idx_ingredient_usage_analytics_company_id ON public.ingredient_usage_analytics(company_id);
CREATE INDEX idx_ingredient_usage_analytics_ingredient_id ON public.ingredient_usage_analytics(ingredient_id);
CREATE INDEX idx_ingredient_usage_analytics_date ON public.ingredient_usage_analytics(date DESC);

-- Enable Row Level Security
ALTER TABLE public.ingredient_usage_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY ingredient_usage_analytics_company_isolation ON public.ingredient_usage_analytics
  FOR ALL
  USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Enable realtime
ALTER TABLE public.ingredient_usage_analytics REPLICA IDENTITY FULL;