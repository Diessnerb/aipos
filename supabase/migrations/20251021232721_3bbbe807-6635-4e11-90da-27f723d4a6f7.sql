-- Add course_type column to order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS course_type TEXT NOT NULL DEFAULT 'main'
CHECK (course_type IN ('starter', 'main', 'dessert'));

-- Add index for filtering by course
CREATE INDEX idx_order_items_course_type ON order_items(course_type);

-- Add comment for documentation
COMMENT ON COLUMN order_items.course_type IS 'Course timing: starter (first), main (second), dessert (third)';