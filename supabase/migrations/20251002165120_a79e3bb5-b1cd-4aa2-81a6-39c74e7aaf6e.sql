-- Create link_templates table for reusable product link configurations
CREATE TABLE IF NOT EXISTS public.link_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  template_name TEXT NOT NULL,
  level_1_pricing_mode TEXT NOT NULL CHECK (level_1_pricing_mode IN ('BASE_PRICE_SETTER', 'ADD_ON_MODIFIER')),
  link_structure_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.link_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for company isolation
CREATE POLICY "link_templates_company_isolation"
ON public.link_templates
FOR ALL
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Create index for faster queries
CREATE INDEX idx_link_templates_company_id ON public.link_templates(company_id);

-- Create trigger for updated_at
CREATE TRIGGER update_link_templates_updated_at
BEFORE UPDATE ON public.link_templates
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();