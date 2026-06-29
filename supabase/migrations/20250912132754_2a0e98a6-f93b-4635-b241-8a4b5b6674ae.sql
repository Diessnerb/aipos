-- Phase 0.3: Enhanced Database Schema for POS Integration & Analytics

-- Add POS integration fields to existing orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS external_pos_order_id TEXT,
ADD COLUMN IF NOT EXISTS pos_sync_status TEXT DEFAULT 'not_synced',
ADD COLUMN IF NOT EXISTS pos_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reservation_id UUID,
ADD COLUMN IF NOT EXISTS table_numbers INTEGER[],
ADD COLUMN IF NOT EXISTS company_id UUID;

-- Add foreign key constraint for reservation_id
ALTER TABLE public.orders 
ADD CONSTRAINT orders_reservation_id_fkey 
FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE SET NULL;

-- Add company_id constraint  
ALTER TABLE public.orders 
ADD CONSTRAINT orders_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_external_pos_id ON public.orders(external_pos_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_pos_sync_status ON public.orders(pos_sync_status);
CREATE INDEX IF NOT EXISTS idx_orders_reservation_id ON public.orders(reservation_id);
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON public.orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_numbers ON public.orders USING GIN(table_numbers);

-- Create daily revenue analytics table
CREATE TABLE IF NOT EXISTS public.daily_revenue_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    analytics_date DATE NOT NULL,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    average_order_value DECIMAL(10,2) DEFAULT 0,
    peak_hour INTEGER,
    peak_hour_revenue DECIMAL(10,2) DEFAULT 0,
    table_turnover_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, analytics_date)
);

-- Create table performance metrics table
CREATE TABLE IF NOT EXISTS public.table_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    metrics_date DATE NOT NULL,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    average_party_size DECIMAL(5,2) DEFAULT 0,
    turnover_count INTEGER DEFAULT 0,
    average_duration_minutes INTEGER DEFAULT 0,
    utilization_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, table_number, metrics_date)
);

-- Create POS order sync logs table
CREATE TABLE IF NOT EXISTS public.pos_order_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    external_pos_order_id TEXT NOT NULL,
    sync_operation TEXT NOT NULL, -- 'create', 'update', 'status_change'
    sync_status TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed', 'conflict'
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    pos_data JSONB DEFAULT '{}',
    error_details TEXT,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for analytics tables
CREATE INDEX IF NOT EXISTS idx_daily_revenue_company_date ON public.daily_revenue_analytics(company_id, analytics_date);
CREATE INDEX IF NOT EXISTS idx_table_performance_company_table_date ON public.table_performance_metrics(company_id, table_number, metrics_date);
CREATE INDEX IF NOT EXISTS idx_pos_sync_logs_company_order ON public.pos_order_sync_logs(company_id, external_pos_order_id);

-- Enable RLS on new tables
ALTER TABLE public.daily_revenue_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_order_sync_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for analytics tables
CREATE POLICY "Company users can view their analytics" 
ON public.daily_revenue_analytics FOR SELECT 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "Company users can manage their analytics" 
ON public.daily_revenue_analytics FOR ALL 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "Company users can view their table metrics" 
ON public.table_performance_metrics FOR SELECT 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "Company users can manage their table metrics" 
ON public.table_performance_metrics FOR ALL 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "Company users can view their sync logs" 
ON public.pos_order_sync_logs FOR SELECT 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "Company users can manage their sync logs" 
ON public.pos_order_sync_logs FOR ALL 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Add trigger to set company_id on orders automatically
CREATE OR REPLACE FUNCTION public.set_order_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER set_order_company_id_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_company_id();

-- Add trigger to update analytics when orders change
CREATE OR REPLACE FUNCTION public.update_revenue_analytics()
RETURNS TRIGGER AS $$
DECLARE
  v_date DATE;
  v_hour INTEGER;
BEGIN
  -- Determine the date and hour for analytics
  IF TG_OP = 'DELETE' THEN
    v_date := OLD.created_at::DATE;
    v_hour := EXTRACT(HOUR FROM OLD.created_at);
  ELSE
    v_date := NEW.created_at::DATE;
    v_hour := EXTRACT(HOUR FROM NEW.created_at);
  END IF;

  -- Update daily revenue analytics
  INSERT INTO public.daily_revenue_analytics (company_id, analytics_date, total_revenue, total_orders, peak_hour, peak_hour_revenue)
  VALUES (
    COALESCE(NEW.company_id, OLD.company_id),
    v_date,
    COALESCE(NEW.total_amount, 0),
    1,
    v_hour,
    COALESCE(NEW.total_amount, 0)
  )
  ON CONFLICT (company_id, analytics_date)
  DO UPDATE SET
    total_revenue = daily_revenue_analytics.total_revenue + COALESCE(NEW.total_amount, 0) - COALESCE(OLD.total_amount, 0),
    total_orders = daily_revenue_analytics.total_orders + 
      CASE 
        WHEN TG_OP = 'INSERT' THEN 1 
        WHEN TG_OP = 'DELETE' THEN -1 
        ELSE 0 
      END,
    average_order_value = CASE 
      WHEN daily_revenue_analytics.total_orders > 0 
      THEN daily_revenue_analytics.total_revenue / daily_revenue_analytics.total_orders 
      ELSE 0 
    END,
    updated_at = NOW();

  -- Update table performance metrics if table_number exists
  IF COALESCE(NEW.table_number, OLD.table_number) IS NOT NULL THEN
    INSERT INTO public.table_performance_metrics (
      company_id, 
      table_number, 
      metrics_date, 
      total_revenue, 
      total_orders
    )
    VALUES (
      COALESCE(NEW.company_id, OLD.company_id),
      COALESCE(NEW.table_number, OLD.table_number),
      v_date,
      COALESCE(NEW.total_amount, 0),
      1
    )
    ON CONFLICT (company_id, table_number, metrics_date)
    DO UPDATE SET
      total_revenue = table_performance_metrics.total_revenue + COALESCE(NEW.total_amount, 0) - COALESCE(OLD.total_amount, 0),
      total_orders = table_performance_metrics.total_orders + 
        CASE 
          WHEN TG_OP = 'INSERT' THEN 1 
          WHEN TG_OP = 'DELETE' THEN -1 
          ELSE 0 
        END,
      average_order_value = CASE 
        WHEN table_performance_metrics.total_orders > 0 
        THEN table_performance_metrics.total_revenue / table_performance_metrics.total_orders 
        ELSE 0 
      END,
      updated_at = NOW();
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_revenue_analytics_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_revenue_analytics();