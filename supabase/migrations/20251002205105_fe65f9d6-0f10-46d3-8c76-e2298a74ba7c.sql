-- Drop the CHECK constraint on meal_category
ALTER TABLE public.menu_items 
DROP CONSTRAINT IF EXISTS menu_items_meal_category_check;

-- Drop the meal_category column
ALTER TABLE public.menu_items 
DROP COLUMN IF EXISTS meal_category;