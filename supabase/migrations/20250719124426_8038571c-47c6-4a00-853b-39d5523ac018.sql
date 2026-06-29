
-- Update the reservations table to support all 26 statuses
ALTER TABLE public.reservations 
DROP CONSTRAINT IF EXISTS reservations_status_check;

-- Add constraint to support all 26 statuses
ALTER TABLE public.reservations 
ADD CONSTRAINT reservations_status_check 
CHECK (status IN (
  'confirmed', 'pending', 'cancelled', 'completed', 'seated', 'no-show',
  'arrived', 'waiting', 'pre-ordered', 'vip', 'large-party', 'special-occasion',
  'dietary-requirements', 'high-maintenance', 'regular-customer', 'first-time',
  'late', 'early', 'modified', 'priority', 'walk-in', 'called-ahead',
  'partial-party', 'full-party', 'checked-in', 'ready-to-seat'
));

-- Update existing reservations with invalid statuses to 'confirmed'
UPDATE public.reservations 
SET status = 'confirmed' 
WHERE status NOT IN (
  'confirmed', 'pending', 'cancelled', 'completed', 'seated', 'no-show',
  'arrived', 'waiting', 'pre-ordered', 'vip', 'large-party', 'special-occasion',
  'dietary-requirements', 'high-maintenance', 'regular-customer', 'first-time',
  'late', 'early', 'modified', 'priority', 'walk-in', 'called-ahead',
  'partial-party', 'full-party', 'checked-in', 'ready-to-seat'
);
