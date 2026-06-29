-- Add locking fields to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_manual_move_time timestamp with time zone DEFAULT NULL;

-- Add index for performance on lock checks
CREATE INDEX IF NOT EXISTS idx_reservations_lock_status 
ON public.reservations(is_locked, last_manual_move_time) 
WHERE is_locked = true OR last_manual_move_time IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.is_locked IS 'Permanent user-set lock to prevent any automated optimization';
COMMENT ON COLUMN public.reservations.last_manual_move_time IS 'Timestamp of last manual move by user, used for 10-second temporary lock on automation';
