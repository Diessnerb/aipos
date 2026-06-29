-- Add timestamp columns for tracking when courses are served
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS starters_served_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mains_served_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS desserts_served_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_reservations_starters_served 
ON public.reservations(starters_served_at) 
WHERE starters_served_at IS NOT NULL 
  AND status = 'starters-served';

CREATE INDEX IF NOT EXISTS idx_reservations_mains_served 
ON public.reservations(mains_served_at) 
WHERE mains_served_at IS NOT NULL 
  AND status = 'mains-served';

CREATE INDEX IF NOT EXISTS idx_reservations_desserts_served 
ON public.reservations(desserts_served_at) 
WHERE desserts_served_at IS NOT NULL 
  AND status = 'desserts-served';

-- Add comments for documentation
COMMENT ON COLUMN public.reservations.starters_served_at IS 'Timestamp when starters were marked as served - used for automatic check-back timer (3 min)';
COMMENT ON COLUMN public.reservations.mains_served_at IS 'Timestamp when mains were marked as served - used for automatic check-back timer (5 min)';
COMMENT ON COLUMN public.reservations.desserts_served_at IS 'Timestamp when desserts were marked as served - used for automatic check-back timer (3 min)';