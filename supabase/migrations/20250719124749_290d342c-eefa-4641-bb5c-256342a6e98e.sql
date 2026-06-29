-- Update the reservations table to support the correct statuses from the image
ALTER TABLE public.reservations 
DROP CONSTRAINT IF EXISTS reservations_status_check;

-- Add constraint to support the correct statuses
ALTER TABLE public.reservations 
ADD CONSTRAINT reservations_status_check 
CHECK (status IN (
  'confirmed', 'pending', 'cancelled', 'no-show', 'completed', 'late', 'seated',
  'waiting-for-order', 'waiting-for-starters', 'starters-ready-in-kitchen', 
  'starters-served', 'requires-check-back-on-starters', 'eating-starters', 
  'clear-starters', 'waiting-for-mains', 'mains-ready-in-kitchen', 'mains-served',
  'requires-check-back-on-mains', 'eating-mains', 'clear-mains', 
  'waiting-for-desserts', 'desserts-ready-in-kitchen', 'desserts-served',
  'requires-check-back-on-desserts', 'eating-dessert', 'clear-desserts',
  'table-cleared', 'bill-requested-waiting-to-pay', 'table-complete'
));

-- Update existing reservations with invalid statuses to 'confirmed'
UPDATE public.reservations 
SET status = 'confirmed' 
WHERE status NOT IN (
  'confirmed', 'pending', 'cancelled', 'no-show', 'completed', 'late', 'seated',
  'waiting-for-order', 'waiting-for-starters', 'starters-ready-in-kitchen', 
  'starters-served', 'requires-check-back-on-starters', 'eating-starters', 
  'clear-starters', 'waiting-for-mains', 'mains-ready-in-kitchen', 'mains-served',
  'requires-check-back-on-mains', 'eating-mains', 'clear-mains', 
  'waiting-for-desserts', 'desserts-ready-in-kitchen', 'desserts-served',
  'requires-check-back-on-desserts', 'eating-dessert', 'clear-desserts',
  'table-cleared', 'bill-requested-waiting-to-pay', 'table-complete'
);