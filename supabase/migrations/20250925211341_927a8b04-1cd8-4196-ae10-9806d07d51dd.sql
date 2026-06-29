-- Add temporary lock column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.locked_until IS 'Temporary lock timestamp to prevent optimization for 10 seconds after manual moves';

-- Create index for efficient querying
CREATE INDEX idx_reservations_locked_until ON public.reservations(locked_until) 
WHERE locked_until IS NOT NULL;