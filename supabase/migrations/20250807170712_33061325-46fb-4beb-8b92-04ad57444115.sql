-- Fix the pin_code constraint issue to allow super admin creation
ALTER TABLE public.users 
ALTER COLUMN pin_code DROP NOT NULL;

-- Update the unique constraint to handle null values properly
DROP INDEX IF EXISTS idx_users_pin_code_unique;
CREATE UNIQUE INDEX idx_users_pin_code_unique ON public.users (pin_code) WHERE pin_code IS NOT NULL;