-- Add anchor_table column to reservations to track user's preferred drop target table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS anchor_table integer;

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.anchor_table IS 'The specific table number the user dropped this reservation on, used as the anchor point for group assignments';

-- Create index for anchor_table queries
CREATE INDEX IF NOT EXISTS idx_reservations_anchor_table ON public.reservations(anchor_table) WHERE anchor_table IS NOT NULL;