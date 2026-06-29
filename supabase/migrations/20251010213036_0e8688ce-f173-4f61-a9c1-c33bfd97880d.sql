-- Drop the duplicate customer trigger that causes race conditions
DROP TRIGGER IF EXISTS trigger_handle_reservation_customer ON public.reservations;

-- Drop the associated function
DROP FUNCTION IF EXISTS public.handle_reservation_customer();

-- The handle_new_customer trigger remains as the single source of truth for customer management