-- Create delivery_settings table
CREATE TABLE IF NOT EXISTS public.delivery_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- General delivery settings
  enable_auto_ordering BOOLEAN DEFAULT false,
  order_lead_time_days INTEGER DEFAULT 2,
  minimum_order_value DECIMAL(10,2) DEFAULT 0,
  
  -- Notification settings
  notify_on_low_stock BOOLEAN DEFAULT true,
  notify_on_order_received BOOLEAN DEFAULT true,
  notification_email TEXT,
  
  -- Default preferences
  default_delivery_window TEXT,
  preferred_delivery_day INTEGER, -- 0-6 for Sunday-Saturday
  
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their company's delivery settings
CREATE POLICY "Users can view their company delivery settings"
  ON public.delivery_settings
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Admins can update their company's delivery settings
CREATE POLICY "Admins can update their company delivery settings"
  ON public.delivery_settings
  FOR UPDATE
  USING (
    company_id IN (
      SELECT u.company_id FROM public.users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'owner')
    )
  );

-- Policy: System can insert delivery settings
CREATE POLICY "System can insert delivery settings"
  ON public.delivery_settings
  FOR INSERT
  WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_delivery_settings_updated_at
  BEFORE UPDATE ON public.delivery_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_delivery_settings_company_id ON public.delivery_settings(company_id);