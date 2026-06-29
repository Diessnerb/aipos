-- Create deals table for managing daily promotional deals
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL,
  deal_name TEXT NOT NULL,
  description TEXT,
  deal_type TEXT NOT NULL DEFAULT 'percentage_off',
  discount_value NUMERIC,
  n_value INTEGER,
  m_value INTEGER,
  start_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '00:00:00',
  end_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '23:59:59',
  is_active BOOLEAN NOT NULL DEFAULT true,
  menu_category_ids UUID[],
  menu_item_ids UUID[],
  applies_to TEXT DEFAULT 'all',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);