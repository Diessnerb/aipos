-- Add modifications column to order_items to store item configuration
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS modifications JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.order_items.modifications IS 'Stores item configuration including ingredient modifications and product link selections';