-- Add reservation_type column to support standard and last-minute reservations
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS reservation_type TEXT DEFAULT 'standard' CHECK (reservation_type IN ('standard', 'last_minute'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_reservations_type ON public.reservations(reservation_type);

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.reservation_type IS 'Type of reservation: standard (2-hour slot) or last_minute (fills gaps between bookings)';
