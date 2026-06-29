-- Add course start timestamp to orders table for accurate per-course timing in kitchen
ALTER TABLE orders ADD COLUMN IF NOT EXISTS current_course_started_at timestamptz;

-- Add index for performance on kitchen queries
CREATE INDEX IF NOT EXISTS idx_orders_current_course_started_at 
ON orders(current_course_started_at) 
WHERE status IN ('sent', 'preparing');