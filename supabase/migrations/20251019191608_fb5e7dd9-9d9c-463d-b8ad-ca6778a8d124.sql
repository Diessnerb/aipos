-- Add missing average_order_value column to fix trigger error
ALTER TABLE public.table_performance_metrics
ADD COLUMN IF NOT EXISTS average_order_value DECIMAL(10,2) DEFAULT 0;

-- Backfill existing rows (guarding against division by zero)
UPDATE public.table_performance_metrics
SET average_order_value = CASE
  WHEN COALESCE(total_orders, 0) > 0 THEN COALESCE(total_revenue, 0)::numeric / total_orders
  ELSE 0
END
WHERE average_order_value IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.table_performance_metrics.average_order_value IS 'Average order value calculated from total_revenue / total_orders';