-- Add category_type column to menu_categories
ALTER TABLE public.menu_categories 
ADD COLUMN IF NOT EXISTS category_type TEXT DEFAULT 'mains' 
CHECK (category_type IN ('drinks', 'starters', 'mains', 'desserts'));

-- Add index for better query performance
CREATE INDEX idx_menu_categories_category_type ON public.menu_categories(category_type);

-- Add comment
COMMENT ON COLUMN public.menu_categories.category_type IS 'Classification: drinks (no kitchen), starters, mains, or desserts';