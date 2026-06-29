-- Create deals table for managing daily promotional deals
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
  deal_name TEXT NOT NULL,
  description TEXT,
  deal_type TEXT NOT NULL DEFAULT 'percentage_off', -- 'percentage_off', 'amount_off', 'set_price', 'n_for_m', 'bogo', 'note'
  discount_value NUMERIC, -- For percentage_off, amount_off, set_price
  n_value INTEGER, -- For n_for_m deals (e.g., 3 in "3 for 2")
  m_value INTEGER, -- For n_for_m deals (e.g., 2 in "3 for 2")
  start_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '00:00:00',
  end_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '23:59:59',
  is_active BOOLEAN NOT NULL DEFAULT true,
  menu_category_ids UUID[], -- Array of menu category IDs this deal applies to
  menu_item_ids UUID[], -- Array of specific menu item IDs this deal applies to  
  applies_to TEXT DEFAULT 'all', -- 'all', 'categories', 'items'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_day_of_week CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT valid_deal_type CHECK (deal_type IN ('percentage_off', 'amount_off', 'set_price', 'n_for_m', 'bogo', 'note')),
  CONSTRAINT valid_applies_to CHECK (applies_to IN ('all', 'categories', 'items')),
  CONSTRAINT valid_time_range CHECK (start_time <= end_time)
);

-- Enable Row Level Security
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for deals
CREATE POLICY "deals_company_isolation" 
ON public.deals 
FOR ALL 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Create trigger to automatically set company_id
CREATE OR REPLACE FUNCTION public.set_deals_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER deals_set_company_id
  BEFORE INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_deals_company_id();

-- Create trigger for updated_at
CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamp();

-- Create indexes for better performance
CREATE INDEX idx_deals_company_day ON public.deals(company_id, day_of_week);
CREATE INDEX idx_deals_active ON public.deals(company_id, is_active);
CREATE INDEX idx_deals_time_range ON public.deals(company_id, day_of_week, start_time, end_time);
CREATE INDEX idx_deals_menu_categories ON public.deals USING GIN(menu_category_ids);
CREATE INDEX idx_deals_menu_items ON public.deals USING GIN(menu_item_ids);