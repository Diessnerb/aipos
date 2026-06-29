-- Add display_order and card_color columns to menu_items table
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS card_color text DEFAULT '#ffffff';

-- Create index for better performance when ordering
CREATE INDEX idx_menu_items_display_order ON public.menu_items(display_order);

-- Update existing menu items to have sequential display_order values using CTE
WITH updated AS (
  SELECT id, row_number() OVER (ORDER BY created_at) as rn
  FROM public.menu_items
  WHERE display_order = 0
)
UPDATE public.menu_items
SET display_order = updated.rn
FROM updated
WHERE public.menu_items.id = updated.id;