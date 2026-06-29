-- Remove old CHECK constraint that only allowed starter, main, dessert
ALTER TABLE public.order_items 
DROP CONSTRAINT IF EXISTS order_items_course_type_check;

-- Add new CHECK constraint that includes 'drinks'
ALTER TABLE public.order_items 
ADD CONSTRAINT order_items_course_type_check 
CHECK (course_type IN ('drinks', 'starter', 'main', 'dessert'));

-- Update comment to reflect all 4 course types
COMMENT ON COLUMN public.order_items.course_type IS 'Course timing: drinks (beverages), starter (first), main (second), dessert (third)';