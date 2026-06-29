-- Add new fields to tables for enhanced categorization
ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS vip_status BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS window_seating BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS privacy_level TEXT DEFAULT 'public',
ADD COLUMN IF NOT EXISTS ambiance TEXT DEFAULT 'casual',
ADD COLUMN IF NOT EXISTS is_high_top BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_outdoor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_quiet_area BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_family_friendly BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_business_friendly BOOLEAN DEFAULT false;