-- Drop the old table (inventory-focused)
DROP TABLE IF EXISTS public.menu_item_ingredients CASCADE;

-- Create new menu_item_ingredients table for ingredient modifiers
CREATE TABLE public.menu_item_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  ingredient_name TEXT NOT NULL,
  is_included BOOLEAN NOT NULL DEFAULT true,
  add_on_cost NUMERIC(10, 2) DEFAULT 0.00,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.menu_item_ingredients ENABLE ROW LEVEL SECURITY;

-- RLS Policy for company isolation
CREATE POLICY "menu_item_ingredients_company_isolation"
ON public.menu_item_ingredients
FOR ALL
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Create indexes
CREATE INDEX idx_menu_item_ingredients_menu_item ON public.menu_item_ingredients(menu_item_id);
CREATE INDEX idx_menu_item_ingredients_company ON public.menu_item_ingredients(company_id);

-- Add trigger for updated_at
CREATE TRIGGER update_menu_item_ingredients_updated_at
BEFORE UPDATE ON public.menu_item_ingredients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();