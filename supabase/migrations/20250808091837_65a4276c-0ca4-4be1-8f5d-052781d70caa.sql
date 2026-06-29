-- Add soft delete fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;