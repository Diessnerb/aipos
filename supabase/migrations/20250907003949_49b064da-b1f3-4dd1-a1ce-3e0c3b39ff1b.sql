-- Create deal_types table
CREATE TABLE IF NOT EXISTS public.deal_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  schema JSONB NOT NULL DEFAULT '{"fields": []}',
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, key)
);

-- Enable Row Level Security
ALTER TABLE public.deal_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for company isolation
CREATE POLICY "deal_types_company_isolation" 
ON public.deal_types 
FOR ALL 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Add custom_fields column to deals table
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}';

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_deal_types_updated_at
BEFORE UPDATE ON public.deal_types
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Set company_id trigger for deal_types
CREATE TRIGGER set_deal_types_company_id
BEFORE INSERT ON public.deal_types
FOR EACH ROW
EXECUTE FUNCTION public.set_company_id_from_user();

-- Seed built-in deal types
INSERT INTO public.deal_types (company_id, key, name, description, schema, is_builtin) VALUES
-- For now, we'll seed these as global (company_id will be set by trigger, but we need them for all companies)
-- We'll handle this differently - let's create a function to seed them per company
(gen_random_uuid(), 'percentage_off', 'Percentage Off', 'Discount by percentage', 
 '{"fields": [{"name": "discount_value", "label": "Discount Percentage", "type": "number", "required": true, "min": 0, "max": 100, "step": 0.01}]}', true),
(gen_random_uuid(), 'amount_off', 'Amount Off', 'Discount by fixed amount', 
 '{"fields": [{"name": "discount_value", "label": "Discount Amount", "type": "currency", "required": true, "min": 0}]}', true),
(gen_random_uuid(), 'set_price', 'Set Price', 'Fixed price for items', 
 '{"fields": [{"name": "discount_value", "label": "Set Price", "type": "currency", "required": true, "min": 0}]}', true),
(gen_random_uuid(), 'n_for_m', 'N for M', 'Buy N items, pay for M', 
 '{"fields": [{"name": "n_value", "label": "Buy Quantity", "type": "integer", "required": true, "min": 1}, {"name": "m_value", "label": "Pay For", "type": "integer", "required": true, "min": 1}]}', true),
(gen_random_uuid(), 'bogo', 'Buy One Get One', 'Buy one get one free/discounted', 
 '{"fields": []}', true),
(gen_random_uuid(), 'note', 'Custom Note', 'Free text description', 
 '{"fields": [{"name": "note_text", "label": "Deal Details", "type": "textarea", "required": true}]}', true);