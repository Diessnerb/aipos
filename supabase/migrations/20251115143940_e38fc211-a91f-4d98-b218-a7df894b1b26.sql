-- Add scheduling mode to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS scheduling_mode TEXT NOT NULL DEFAULT 'lead_time' CHECK (scheduling_mode IN ('lead_time', 'fixed_schedule'));

-- Create delivery_schedules table
CREATE TABLE IF NOT EXISTS public.delivery_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  order_day_of_week INTEGER NOT NULL CHECK (order_day_of_week >= 0 AND order_day_of_week <= 6),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  delivery_time TIME,
  cutoff_time TIME,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_company_id ON public.delivery_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_supplier_id ON public.delivery_schedules(supplier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_order_day ON public.delivery_schedules(order_day_of_week);

-- Enable RLS
ALTER TABLE public.delivery_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policy for delivery schedules
CREATE POLICY delivery_schedules_company_isolation ON public.delivery_schedules
  FOR ALL
  USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Add comments
COMMENT ON COLUMN public.suppliers.scheduling_mode IS 'Determines how delivery scheduling works: lead_time (X days after order) or fixed_schedule (specific order/delivery days)';
COMMENT ON COLUMN public.delivery_schedules.order_day_of_week IS 'Day of week when order must be placed (0=Sunday, 1=Monday, ..., 6=Saturday)';
COMMENT ON COLUMN public.delivery_schedules.day_of_week IS 'Day of week when delivery occurs (0=Sunday, 1=Monday, ..., 6=Saturday)';

-- Enable realtime
ALTER TABLE public.delivery_schedules REPLICA IDENTITY FULL;