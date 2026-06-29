-- Add timestamp column for tracking when guests are seated
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS seated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_reservations_seated 
ON public.reservations(seated_at) 
WHERE seated_at IS NOT NULL 
  AND status = 'seated';

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.seated_at IS 'Timestamp when guests were marked as seated - used for 3-minute waiting-for-order timer';