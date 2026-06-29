-- Create menu_categories table with hierarchical structure
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for menu_categories
CREATE POLICY "Allow all operations on menu_categories" 
ON public.menu_categories 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add category_id column to menu_items table
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_menu_categories_parent_id ON public.menu_categories(parent_id);
CREATE INDEX idx_menu_categories_display_order ON public.menu_categories(display_order);
CREATE INDEX idx_menu_items_category_id ON public.menu_items(category_id);

-- Create trigger for updated_at
CREATE TRIGGER update_menu_categories_updated_at
  BEFORE UPDATE ON public.menu_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamp();

-- Insert default categories based on existing structure
INSERT INTO public.menu_categories (name, display_order) VALUES
('Tapas', 1),
('Pizza', 2),
('Breakfast', 3),
('Cakes/Snacks', 4),
('Soft Drinks', 5),
('Bottles', 6),
('Wines', 7);

-- Insert subcategories for Soft Drinks
INSERT INTO public.menu_categories (name, parent_id, display_order) VALUES
('Pints', (SELECT id FROM public.menu_categories WHERE name = 'Soft Drinks'), 1),
('Half Pints', (SELECT id FROM public.menu_categories WHERE name = 'Soft Drinks'), 2);