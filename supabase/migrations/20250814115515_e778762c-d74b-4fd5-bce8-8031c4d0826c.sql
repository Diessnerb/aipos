-- Add missing columns to tables for enhanced table management
ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS accessibility_friendly BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;