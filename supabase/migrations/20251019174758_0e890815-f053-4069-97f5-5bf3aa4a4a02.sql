-- Fix orders.created_by foreign key to reference public.users instead of auth.users
-- This allows proper querying and joining with the public.users table

-- Drop the existing foreign key constraint
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_created_by_fkey;

-- Add new foreign key constraint pointing to public.users
ALTER TABLE public.orders
ADD CONSTRAINT orders_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES public.users(id) 
ON DELETE SET NULL;