-- Create product_links table for hierarchical product configuration
CREATE TABLE IF NOT EXISTS public.product_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  parent_link_id UUID REFERENCES public.product_links(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  option_name TEXT NOT NULL,
  price_modifier NUMERIC(10, 2),
  base_price NUMERIC(10, 2),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT product_links_price_check CHECK (
    (price_modifier IS NOT NULL AND base_price IS NULL) OR
    (price_modifier IS NULL AND base_price IS NOT NULL) OR
    (price_modifier IS NULL AND base_price IS NULL)
  )
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_links_menu_item ON public.product_links(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_product_links_parent ON public.product_links(parent_link_id);
CREATE INDEX IF NOT EXISTS idx_product_links_company ON public.product_links(company_id);
CREATE INDEX IF NOT EXISTS idx_product_links_level ON public.product_links(level);

-- Enable RLS
ALTER TABLE public.product_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "product_links_company_isolation"
  ON public.product_links
  FOR ALL
  USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Trigger for updated_at
CREATE TRIGGER update_product_links_updated_at
  BEFORE UPDATE ON public.product_links
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Trigger to set company_id from menu_item
CREATE OR REPLACE FUNCTION set_product_link_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM public.menu_items WHERE id = NEW.menu_item_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER set_product_link_company_id_trigger
  BEFORE INSERT ON public.product_links
  FOR EACH ROW
  EXECUTE FUNCTION set_product_link_company_id();